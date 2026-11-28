import type { EntityManager } from 'typeorm';
import { KgaraCase } from '../entities/kgara_case.entity';

/**
 * Luật công nợ xe ngoài (OJ), nguồn duy nhất:
 * OJ đã gắn hóa đơn đầu ra còn hiệu lực thì tính công nợ (phải thu và phải trả);
 * chưa gắn (kể cả khi phiếu có VAT) thì loại khỏi công nợ.
 */
export const isOjClassification = (classification?: string | null): boolean =>
  classification === 'OJ' || classification === 'OJ_NGOAI';

/**
 * Hóa đơn đầu ra còn hiệu lực: chưa xóa, không bị thay thế (4) hay hủy (6).
 * Hóa đơn bị điều chỉnh (5) vẫn còn hiệu lực.
 */
const ACTIVE_OUT_INVOICE_FROM_SQL = `FROM kgara_case_linked_invoice l
  JOIN erp_invoices i ON i.id = l."invoiceId"
  WHERE l."linkType" = 'OUT'
    AND i.is_deleted = false
    AND COALESCE(i.tax_invoice_status, 1) NOT IN (4, 6)
    AND UPPER(COALESCE(i.status::text, '')) <> 'CANCELLED'`;

export const ACTIVE_OUT_INVOICE_EXISTS_SQL = `SELECT EXISTS (
  SELECT 1 ${ACTIVE_OUT_INVOICE_FROM_SQL}
    AND l."caseDbId"::text = $1
) AS has`;

const INVOICED_CASE_IDS_SQL = `SELECT DISTINCT l."caseDbId"::text AS id
  ${ACTIVE_OUT_INVOICE_FROM_SQL}
    AND l."caseDbId"::text = ANY($1::text[])`;

type ClassifiedCase = { id: string; classification?: string | null };

/** Tra theo lô cho danh sách và bảng kê: id các phiếu OJ đã gắn hóa đơn đầu ra còn hiệu lực. */
export async function findOjInvoicedCaseIds(
  manager: Pick<EntityManager, 'query'>,
  cases: ClassifiedCase[],
): Promise<Set<string>> {
  const ids = cases
    .filter((c) => isOjClassification(c.classification))
    .map((c) => c.id);
  if (!ids.length) return new Set();
  const rows: Array<{ id: string }> = await manager.query(
    INVOICED_CASE_IDS_SQL,
    [ids],
  );
  return new Set(rows.map((r) => r.id));
}

/** Trường `ojHasInvoice` của API: `null` khi phiếu không phải OJ. */
export const ojHasInvoiceOf = (
  row: ClassifiedCase,
  invoicedIds?: ReadonlySet<string>,
): boolean | null =>
  isOjClassification(row.classification)
    ? (invoicedIds?.has(row.id) ?? false)
    : null;

/** Bảng kê: gắn `ojHasInvoice` ngay trên phiếu để tách "OJ" và "OJ có gắn hóa đơn". */
export async function attachOjHasInvoice(
  manager: Pick<EntityManager, 'query'>,
  cases: Array<ClassifiedCase & { ojHasInvoice?: boolean | null }>,
): Promise<void> {
  const invoiced = await findOjInvoicedCaseIds(manager, cases);
  for (const c of cases) c.ojHasInvoice = ojHasInvoiceOf(c, invoiced);
}

/** Giá trị `exclude_from_debt` của một phiếu OJ. Phiếu chưa lưu thì chưa thể có hóa đơn. */
export async function resolveOjExcludeFromDebt(
  manager: Pick<EntityManager, 'query'>,
  caseDbId: string | null | undefined,
): Promise<boolean> {
  if (!caseDbId) return true;
  const rows: Array<{ has: boolean }> = await manager.query(
    ACTIVE_OUT_INVOICE_EXISTS_SQL,
    [caseDbId],
  );
  return rows?.[0]?.has !== true;
}

/** Tính lại cờ công nợ của một phiếu OJ sau khi liên kết hóa đơn đổi. Trả `true` nếu có ghi. */
export async function refreshOjDebtFlag(
  manager: Pick<EntityManager, 'query' | 'findOne' | 'update'>,
  caseDbId: string,
): Promise<boolean> {
  const row = await manager.findOne(KgaraCase, { where: { id: caseDbId } });
  if (!row || !isOjClassification(row.classification)) return false;
  const excludeFromDebt = await resolveOjExcludeFromDebt(manager, caseDbId);
  if (row.excludeFromDebt === excludeFromDebt) return false;
  await manager.update(KgaraCase, caseDbId, { excludeFromDebt });
  return true;
}
