/**
 * Truy vấn backfill file hóa đơn V1 → `file_attachments` (owner `INVOICE`, origin `LEGACY`).
 * Chỉ trỏ lại khóa R2 cũ, không copy object. Nhiều nguồn trùng khóa cho cùng hóa đơn được gộp,
 * ưu tiên bản có metadata (`erp_attachments`) rồi tới cột khóa trên hóa đơn.
 */

/** Nguồn theo thứ tự ưu tiên (số nhỏ thắng khi trùng (hóa đơn, khóa)). */
export const BACKFILL_SOURCES = [
  'erp_attachments',
  'erp_invoices.pdf_file_key',
  'erp_invoices.xml_file_key',
  'erp_invoices.pdf_files',
] as const;
export type BackfillSource = (typeof BACKFILL_SOURCES)[number];

const CANDIDATES_CTE = `
  candidates AS (
    SELECT l.invoice_id AS invoice_id, a.file_key AS file_key, a.file_name AS file_name,
           a.file_size::bigint AS file_size, a.mime_type AS mime_type,
           a.document_type::text AS category, COALESCE(a.file_key = i.pdf_file_key, false) AS is_original,
           a.created_by AS created_by, a.created_at::timestamptz AS created_at,
           'erp_attachments:' || a.id::text AS legacy_source, 1 AS priority
    FROM erp_invoice_attachments l
    JOIN erp_attachments a ON a.id = l.attachment_id
    JOIN erp_invoices i ON i.id = l.invoice_id
    WHERE i.is_deleted = false AND a.file_key IS NOT NULL AND a.file_key <> ''
    UNION ALL
    SELECT i.id, i.pdf_file_key, regexp_replace(i.pdf_file_key, '^.*/', ''), 0,
           'application/pdf', 'HOA_DON', true, NULL, i.created_at::timestamptz,
           'erp_invoices.pdf_file_key', 2
    FROM erp_invoices i
    WHERE i.is_deleted = false AND i.pdf_file_key IS NOT NULL AND i.pdf_file_key <> ''
    UNION ALL
    SELECT i.id, i.xml_file_key, regexp_replace(i.xml_file_key, '^.*/', ''), 0,
           'application/xml', 'HOA_DON', false, NULL, i.created_at::timestamptz,
           'erp_invoices.xml_file_key', 3
    FROM erp_invoices i
    WHERE i.is_deleted = false AND i.xml_file_key IS NOT NULL AND i.xml_file_key <> ''
    UNION ALL
    SELECT i.id, e.elem ->> 'key',
           COALESCE(NULLIF(e.elem ->> 'filename', ''), regexp_replace(e.elem ->> 'key', '^.*/', '')),
           0, 'application/pdf', 'HOA_DON', false, NULL,
           COALESCE(NULLIF(e.elem ->> 'uploadedAt', '')::timestamptz, i.created_at::timestamptz),
           'erp_invoices.pdf_files', 4
    FROM erp_invoices i
    CROSS JOIN LATERAL jsonb_array_elements(
      CASE WHEN jsonb_typeof(i.pdf_files) = 'array' THEN i.pdf_files ELSE '[]'::jsonb END
    ) AS e(elem)
    WHERE i.is_deleted = false AND COALESCE(e.elem ->> 'key', '') <> ''
  ),
  dedup AS (
    SELECT DISTINCT ON (invoice_id, file_key) *
    FROM candidates
    ORDER BY invoice_id, file_key, priority
  )`;

/** Số liệu trước khi ghi: số ứng viên theo nguồn sau khi gộp, và số đã có sẵn ở V2. */
export const PREVIEW_SQL = `
  WITH ${CANDIDATES_CTE}
  SELECT split_part(d.legacy_source, ':', 1) AS source,
         COUNT(*)::int AS candidates,
         COUNT(*) FILTER (WHERE EXISTS (
           SELECT 1 FROM file_attachments f
           WHERE f.owner_type = 'INVOICE' AND f.owner_id = d.invoice_id
             AND f.file_key = d.file_key AND f.is_deleted = false
         ))::int AS already_present
  FROM dedup d
  GROUP BY 1
  ORDER BY 1`;

/** Ghi thật (idempotent nhờ unique một phần `owner_type, owner_id, file_key WHERE is_deleted = false`). */
export const INSERT_SQL = `
  WITH ${CANDIDATES_CTE},
  inserted AS (
    INSERT INTO file_attachments
      (owner_type, owner_id, category, is_original, file_name, file_key, origin,
       legacy_source, file_size, mime_type, created_by, created_at, updated_at)
    SELECT 'INVOICE', d.invoice_id,
           CASE WHEN d.category IN ('HOA_DON','BANG_KE','HOP_DONG','KHAC') THEN d.category ELSE 'KHAC' END,
           d.is_original, left(d.file_name, 255), d.file_key, 'LEGACY',
           left(d.legacy_source, 96), d.file_size, d.mime_type, d.created_by, d.created_at, d.created_at
    FROM dedup d
    ON CONFLICT (owner_type, owner_id, file_key) WHERE is_deleted = false DO NOTHING
    RETURNING legacy_source
  )
  SELECT split_part(legacy_source, ':', 1) AS source, COUNT(*)::int AS inserted
  FROM inserted GROUP BY 1 ORDER BY 1`;

/** Hóa đơn đã xóa mềm còn khóa file: bị bỏ qua (báo cáo để biết). */
export const SKIPPED_DELETED_SQL = `
  SELECT COUNT(*)::int AS invoices
  FROM erp_invoices i
  WHERE i.is_deleted = true
    AND (i.pdf_file_key IS NOT NULL OR i.xml_file_key IS NOT NULL
         OR EXISTS (SELECT 1 FROM erp_invoice_attachments l WHERE l.invoice_id = i.id))`;

export interface PreviewRow {
  source: string;
  candidates: number;
  already_present: number;
}
export interface InsertedRow {
  source: string;
  inserted: number;
}

export interface BackfillReport {
  bySource: Array<{
    source: string;
    candidates: number;
    alreadyPresent: number;
    toInsert: number;
    inserted: number;
  }>;
  totalCandidates: number;
  totalAlreadyPresent: number;
  totalInserted: number;
}

/** Gộp số liệu preview và kết quả ghi thành báo cáo theo nguồn (hàm thuần). */
export function buildReport(
  preview: PreviewRow[],
  inserted: InsertedRow[],
): BackfillReport {
  const insertedBy = new Map(inserted.map((r) => [r.source, r.inserted]));
  const bySource = preview.map((p) => ({
    source: p.source,
    candidates: p.candidates,
    alreadyPresent: p.already_present,
    toInsert: p.candidates - p.already_present,
    inserted: insertedBy.get(p.source) ?? 0,
  }));
  const sum = (pick: (r: (typeof bySource)[number]) => number) =>
    bySource.reduce((acc, r) => acc + pick(r), 0);
  return {
    bySource,
    totalCandidates: sum((r) => r.candidates),
    totalAlreadyPresent: sum((r) => r.alreadyPresent),
    totalInserted: sum((r) => r.inserted),
  };
}
