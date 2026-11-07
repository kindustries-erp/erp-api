/**
 * Ghi dữ liệu cho backfill-garage-cashflow.ts (--apply). Một transaction duy nhất:
 * ghi xong thì đối chiếu lại với nguồn; lệch bất kỳ mục nào thì ROLLBACK.
 *
 * Quy tắc (id giữ nguyên để không gãy tham chiếu):
 *  - Phiếu cũ -> cashflow_forecasts (id = voucher.id, code = voucher_code) + cashflow_garage_forecast_ext.
 *  - Phiếu đã thu/chi -> cashflow_payments (code = 'PM-' || voucher_code) + cashflow_allocations đủ số tiền.
 *  - PR chưa xóa -> cashflow_forecasts kind = PURCHASE (id = PR.id) + dòng hàng (id = dòng PR.id).
 *    Vì giữ id dòng, request_line_id của dòng PO vẫn trỏ đúng; chỉ FK cần đổi bảng.
 *  - Settlement KHÔNG ghi ở bước này. Chỉ báo cáo số chênh lệch để đối chiếu ở P1.3.
 *
 * Chạy lại an toàn: mọi lệnh INSERT đều có ON CONFLICT hoặc NOT EXISTS.
 */

import type { Client } from 'pg';

/** Phạm vi phiếu cũ đưa vào lõi mới. Khớp đúng 5 nhóm của dry-run (718 phiếu). */
function voucherScope(a: string): string {
  return `(
    (${a}.voucher_type = 'RECEIPT' AND (${a}.payment_status IN ('EXPECTED','PAID','CANCELLED') OR ${a}.payment_status IS NULL))
    OR (${a}.voucher_type = 'PAYMENT' AND ${a}.payment_status IN ('PAID','PENDING'))
  )`;
}

function debtCountedSql(a: string): string {
  return `NOT (${a}.voucher_type = 'RECEIPT' AND ${a}.payment_status IS NULL AND NOT EXISTS (SELECT 1 FROM kgara_case_settlements s WHERE s.cashflow_voucher_id = ${a}.id))`;
}

/** Phiếu thu NULL: tạo thanh toán/phân bổ khi có settlement hoặc có liên kết ngân hàng (giữ link; công nợ dùng debt_counted). */
function paidScope(a: string): string {
  return `(
    (${a}.voucher_type = 'RECEIPT' AND ${a}.payment_status = 'PAID')
    OR (${a}.voucher_type = 'RECEIPT' AND ${a}.payment_status IS NULL AND (
      ${a}.erp_bank_transaction_id IS NOT NULL
      OR EXISTS (SELECT 1 FROM kgara_case_settlements s WHERE s.cashflow_voucher_id = ${a}.id)))
    OR (${a}.voucher_type = 'PAYMENT' AND ${a}.payment_status = 'PAID')
  )`;
}

const PR_SCOPE = 'r.is_deleted = false';

/**
 * Nhãn phương thức gốc (tiếng Việt, và mã tiếng Anh nếu có) -> kênh của thanh toán.
 * Dữ liệu staging chỉ có: "Chuyển khoản", "Thẻ tín dụng", "Khác" (và NULL).
 */
function channelFromLabel(column: string): string {
  return `CASE TRIM(COALESCE(${column}, ''))
           WHEN 'Chuyển khoản' THEN 'BANK'
           WHEN 'BANK_TRANSFER' THEN 'BANK'
           WHEN 'BANK' THEN 'BANK'
           WHEN 'Tiền mặt' THEN 'CASH'
           WHEN 'CASH' THEN 'CASH'
           WHEN 'Thẻ tín dụng' THEN 'POS'
           WHEN 'POS' THEN 'POS'
           ELSE 'OTHER' END`;
}

export interface BackfillStepResult {
  step: string;
  rows: number;
}

export interface BackfillReport {
  steps: BackfillStepResult[];
  checks: Array<{
    label: string;
    expected: string;
    actual: string;
    ok: boolean;
  }>;
  settlementMismatch: number;
}

async function scalar(client: Client, sql: string): Promise<string> {
  const { rows } = await client.query<Record<string, string>>(sql);
  return String(Object.values(rows[0])[0]);
}

async function pair(
  client: Client,
  sql: string,
): Promise<{ n: string; total: string }> {
  const { rows } = await client.query<{ n: string; total: string }>(sql);
  return rows[0];
}

export async function applyGarageCashflowBackfill(
  client: Client,
  options: { commit?: boolean } = {},
): Promise<BackfillReport> {
  const commit = options.commit !== false;
  const steps: BackfillStepResult[] = [];
  const run = async (step: string, sql: string): Promise<void> => {
    const res = await client.query(sql);
    steps.push({ step, rows: res.rowCount ?? 0 });
  };

  await client.query('BEGIN');
  try {
    await run(
      'forecast <- phiếu cũ',
      `INSERT INTO cashflow_forecasts (
         id, code, direction, kind, source, source_type, source_id,
         partner_name, branch_id, amount, planned_date, status,
         requires_approval, note, is_deleted, created_by, created_at, updated_at)
       SELECT v.id, v.voucher_code,
         CASE WHEN v.voucher_type = 'RECEIPT' THEN 'IN' ELSE 'OUT' END,
         CASE WHEN v.is_auto_commission THEN 'COMMISSION'
              WHEN v.voucher_type = 'RECEIPT' THEN 'CASE_RECEIVABLE'
              ELSE 'OTHER' END,
         CASE WHEN COALESCE(v.is_auto_expected, false) OR COALESCE(v.is_auto_commission, false)
              THEN 'AUTO' ELSE 'MANUAL' END,
         'LEGACY_VOUCHER', v.id,
         v.partner_name, NULL, v.amount, v.trans_date,
         CASE
           WHEN v.payment_status = 'CANCELLED' THEN 'CANCELLED'
           WHEN v.voucher_type = 'RECEIPT' AND v.payment_status = 'EXPECTED' THEN 'OPEN'
           WHEN v.voucher_type = 'RECEIPT' THEN 'SETTLED'
           WHEN v.payment_status = 'PAID' THEN 'SETTLED'
           ELSE 'PENDING_APPROVAL'
         END,
         (v.voucher_type = 'PAYMENT'),
         v.note, false,
         CASE WHEN v.created_by ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
              THEN v.created_by::uuid ELSE NULL END,
         v.created_at, v.updated_at
         FROM kgara_cashflow_vouchers v
        WHERE ${voucherScope('v')}
       ON CONFLICT (id) DO NOTHING`,
    );

    await run(
      'ext <- phiếu cũ',
      `INSERT INTO cashflow_garage_forecast_ext (
         forecast_id, case_id, license_plate, payment_content,
         is_auto_expected, is_auto_commission,
         pnl_period_year, pnl_period_month, pnl_commission_type, pnl_commission_anchor_id,
         legacy_created_by, legacy_payment_method, debt_counted)
       SELECT v.id, v.case_id, v.license_plate, v.payment_content,
         COALESCE(v.is_auto_expected, false), COALESCE(v.is_auto_commission, false),
         v.pnl_period_year, v.pnl_period_month, v.pnl_commission_type, v.pnl_commission_anchor_id,
         v.created_by, v.payment_method, ${debtCountedSql('v')}
         FROM kgara_cashflow_vouchers v
        WHERE ${voucherScope('v')}
       ON CONFLICT (forecast_id) DO UPDATE SET
         legacy_created_by = EXCLUDED.legacy_created_by,
         legacy_payment_method = EXCLUDED.legacy_payment_method,
         debt_counted = EXCLUDED.debt_counted`,
    );

    await run(
      'dọn thanh toán của phiếu thu NULL không có settlement và không có liên kết ngân hàng',
      `DELETE FROM cashflow_payments p
        USING kgara_cashflow_vouchers v
       WHERE p.code = 'PM-' || v.voucher_code
         AND v.voucher_type = 'RECEIPT' AND v.payment_status IS NULL
         AND v.erp_bank_transaction_id IS NULL
         AND NOT EXISTS (SELECT 1 FROM kgara_case_settlements s WHERE s.cashflow_voucher_id = v.id)`,
    );

    await run(
      'payment <- phiếu đã thu/chi',
      `INSERT INTO cashflow_payments (
         code, direction, amount, trans_date, channel, bank_transaction_id,
         partner_name, status, note, is_deleted, created_at, updated_at)
       SELECT 'PM-' || v.voucher_code,
         CASE WHEN v.voucher_type = 'RECEIPT' THEN 'IN' ELSE 'OUT' END,
         v.amount, v.trans_date,
         ${channelFromLabel('v.payment_method')},
         v.erp_bank_transaction_id,
         v.partner_name, 'POSTED', v.note, false, v.created_at, v.updated_at
         FROM kgara_cashflow_vouchers v
        WHERE ${paidScope('v')}
       ON CONFLICT (code) DO UPDATE SET channel = EXCLUDED.channel`,
    );

    await run(
      'allocation <- phiếu đã thu/chi (đủ số tiền)',
      `INSERT INTO cashflow_allocations (payment_id, forecast_id, amount, created_at)
       SELECT p.id, v.id, v.amount, v.created_at
         FROM kgara_cashflow_vouchers v
         JOIN cashflow_payments p ON p.code = 'PM-' || v.voucher_code
        WHERE ${paidScope('v')}
          AND NOT EXISTS (
            SELECT 1 FROM cashflow_allocations a
             WHERE a.payment_id = p.id AND a.forecast_id = v.id)`,
    );

    await run(
      'forecast PURCHASE <- PR',
      `INSERT INTO cashflow_forecasts (
         id, code, direction, kind, source, source_type, source_id,
         partner_name, branch_id, amount, planned_date, status,
         requires_approval, note, is_deleted, created_by, created_at, updated_at,
         submitted_by, submitted_at, approver_id, approved_by, approved_at,
         rejected_by, rejected_at, reject_reason, title, requester_employee_id)
       SELECT r.id, r.request_no, 'OUT', 'PURCHASE', 'MANUAL', 'LEGACY_PR', NULL,
         NULL, r.branch_id,
         COALESCE(NULLIF((SELECT sum(l.est_amount) FROM erp_garage_proc_request_lines l WHERE l.request_id = r.id), 0),
                  r.estimated_total, 0),
         COALESCE(r.needed_date, r.request_date),
         CASE r.status
           WHEN 'DRAFT' THEN 'DRAFT'
           WHEN 'APPROVED' THEN 'OPEN'
           WHEN 'CLOSED' THEN 'CANCELLED'
           WHEN 'CANCELLED' THEN 'CANCELLED'
           ELSE 'DRAFT' END,
         true, r.remarks, false, r.created_by, r.created_at, r.updated_at,
         r.submitted_by, r.submitted_at, r.approver_id, r.approved_by, r.approved_at,
         r.rejected_by, r.rejected_at, r.reject_reason, r.title, r.requester_employee_id
         FROM erp_garage_proc_requests r
        WHERE ${PR_SCOPE}
       ON CONFLICT (id) DO UPDATE SET
         title = EXCLUDED.title, requester_employee_id = EXCLUDED.requester_employee_id,
         status = EXCLUDED.status, amount = EXCLUDED.amount,
         planned_date = EXCLUDED.planned_date, branch_id = EXCLUDED.branch_id,
         note = EXCLUDED.note, submitted_by = EXCLUDED.submitted_by,
         submitted_at = EXCLUDED.submitted_at, approver_id = EXCLUDED.approver_id,
         approved_by = EXCLUDED.approved_by, approved_at = EXCLUDED.approved_at,
         rejected_by = EXCLUDED.rejected_by, rejected_at = EXCLUDED.rejected_at,
         reject_reason = EXCLUDED.reject_reason, updated_at = EXCLUDED.updated_at`,
    );

    await run(
      'ext PR (dấu đóng)',
      `INSERT INTO cashflow_garage_forecast_ext (forecast_id, is_auto_expected, is_auto_commission, closed_at, close_reason)
       SELECT r.id, false, false,
              CASE WHEN r.status = 'CLOSED' THEN r.closed_at END,
              CASE WHEN r.status = 'CLOSED' THEN r.close_reason END
         FROM erp_garage_proc_requests r
        WHERE ${PR_SCOPE}
       ON CONFLICT (forecast_id) DO UPDATE SET
         closed_at = EXCLUDED.closed_at, close_reason = EXCLUDED.close_reason`,
    );

    await run(
      'forecast lines <- dòng PR (giữ id)',
      `INSERT INTO cashflow_forecast_lines (
         id, forecast_id, line_no, line_type, item_name, qty_requested, qty_ordered,
         unit_price, amount, created_at, updated_at, item_id, item_code, description, notes)
       SELECT l.id, l.request_id, l.line_no,
         CASE WHEN l.line_type = 'SERVICE' THEN 'SERVICE' ELSE 'GOODS' END,
         COALESCE(NULLIF(l.item_name, ''), NULLIF(l.item_code, ''), '(không tên)'),
         l.qty_requested, l.qty_ordered,
         COALESCE(l.est_unit_price, 0), COALESCE(l.est_amount, 0),
         l.created_at, l.updated_at, l.item_id, l.item_code, l.description, l.notes
         FROM erp_garage_proc_request_lines l
         JOIN erp_garage_proc_requests r ON r.id = l.request_id
        WHERE ${PR_SCOPE}
       ON CONFLICT (id) DO UPDATE SET
         item_id = EXCLUDED.item_id, item_code = EXCLUDED.item_code,
         description = EXCLUDED.description, notes = EXCLUDED.notes,
         line_type = EXCLUDED.line_type, item_name = EXCLUDED.item_name,
         qty_requested = EXCLUDED.qty_requested, qty_ordered = EXCLUDED.qty_ordered,
         unit_price = EXCLUDED.unit_price, amount = EXCLUDED.amount,
         updated_at = EXCLUDED.updated_at`,
    );

    // Dòng PR đã bị xóa ở nguồn thì bỏ khỏi dự chi (chỉ dòng của PR đang còn trong nguồn).
    await run(
      'dọn dòng PR không còn ở nguồn',
      `DELETE FROM cashflow_forecast_lines fl
        WHERE fl.forecast_id IN (SELECT r.id FROM erp_garage_proc_requests r WHERE ${PR_SCOPE})
          AND NOT EXISTS (SELECT 1 FROM erp_garage_proc_request_lines l WHERE l.id = fl.id)`,
    );

    const settlementMismatch = Number(
      await scalar(
        client,
        `SELECT count(*)::text FROM (
           SELECT s.cashflow_voucher_id AS vid, sum(s.amount) AS sa
             FROM kgara_case_settlements s
            WHERE s.cashflow_voucher_id IS NOT NULL
            GROUP BY s.cashflow_voucher_id) x
           JOIN kgara_cashflow_vouchers v ON v.id = x.vid
          WHERE x.sa <> v.amount`,
      ),
    );

    const checks = await collectChecks(client);
    if (!commit) {
      await client.query('ROLLBACK');
      return { steps, checks, settlementMismatch };
    }
    if (checks.some((c) => !c.ok)) {
      throw new Error(
        `Đối chiếu sau ghi lệch: ${checks
          .filter((c) => !c.ok)
          .map((c) => `${c.label} (kỳ vọng ${c.expected}, thực tế ${c.actual})`)
          .join('; ')}`,
      );
    }
    await client.query('COMMIT');
    return { steps, checks, settlementMismatch };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}

async function collectChecks(
  client: Client,
): Promise<BackfillReport['checks']> {
  const out: BackfillReport['checks'] = [];
  const eq = (label: string, expected: string, actual: string) =>
    out.push({
      label,
      expected,
      actual,
      ok: Math.abs(Number(expected) - Number(actual)) < 0.005,
    });

  const vExp = await pair(
    client,
    `SELECT count(*)::text n, COALESCE(sum(v.amount), 0)::text total
       FROM kgara_cashflow_vouchers v WHERE ${voucherScope('v')}`,
  );
  const vAct = await pair(
    client,
    `SELECT count(*)::text n, COALESCE(sum(f.amount), 0)::text total
       FROM cashflow_forecasts f JOIN kgara_cashflow_vouchers v ON v.id = f.id
      WHERE f.source_type = 'LEGACY_VOUCHER' AND ${voucherScope('v')}`,
  );
  eq('dự thu/dự chi từ phiếu: số lượng', vExp.n, vAct.n);
  eq('dự thu/dự chi từ phiếu: tổng tiền', vExp.total, vAct.total);

  const extAct = await scalar(
    client,
    `SELECT count(*)::text FROM cashflow_garage_forecast_ext e
       JOIN kgara_cashflow_vouchers v ON v.id = e.forecast_id
      WHERE ${voucherScope('v')}`,
  );
  eq('ext phiếu: số lượng', vExp.n, extAct);

  const pExp = await pair(
    client,
    `SELECT count(*)::text n, COALESCE(sum(v.amount), 0)::text total
       FROM kgara_cashflow_vouchers v WHERE ${paidScope('v')}`,
  );
  const pAct = await pair(
    client,
    `SELECT count(*)::text n, COALESCE(sum(p.amount), 0)::text total
       FROM cashflow_payments p WHERE p.code LIKE 'PM-%'
        AND EXISTS (SELECT 1 FROM kgara_cashflow_vouchers v
                     WHERE 'PM-' || v.voucher_code = p.code AND ${paidScope('v')})`,
  );
  eq('thanh toán từ phiếu đã thu/chi: số lượng', pExp.n, pAct.n);
  eq('thanh toán từ phiếu đã thu/chi: tổng tiền', pExp.total, pAct.total);

  const aAct = await pair(
    client,
    `SELECT count(*)::text n, COALESCE(sum(a.amount), 0)::text total
       FROM cashflow_allocations a
       JOIN cashflow_payments p ON p.id = a.payment_id
      WHERE p.code LIKE 'PM-%' AND a.forecast_id IN (
        SELECT v.id FROM kgara_cashflow_vouchers v WHERE ${paidScope('v')})`,
  );
  eq('phân bổ từ phiếu đã thu/chi: số lượng', pExp.n, aAct.n);
  eq('phân bổ từ phiếu đã thu/chi: tổng tiền', pExp.total, aAct.total);

  const prExp = await scalar(
    client,
    `SELECT count(*)::text FROM erp_garage_proc_requests r WHERE ${PR_SCOPE}`,
  );
  const prAct = await scalar(
    client,
    `SELECT count(*)::text FROM cashflow_forecasts f
      WHERE f.source_type = 'LEGACY_PR'`,
  );
  eq('dự chi mua hàng từ PR: số lượng', prExp, prAct);

  const lExp = await scalar(
    client,
    `SELECT count(*)::text FROM erp_garage_proc_request_lines l
       JOIN erp_garage_proc_requests r ON r.id = l.request_id
      WHERE ${PR_SCOPE}`,
  );
  const lAct = await scalar(
    client,
    `SELECT count(*)::text FROM cashflow_forecast_lines l
       JOIN erp_garage_proc_requests r ON r.id = l.forecast_id
      WHERE ${PR_SCOPE}`,
  );
  eq('dòng hàng từ PR: số lượng', lExp, lAct);

  const poExp = await scalar(
    client,
    `SELECT count(*)::text FROM erp_garage_proc_order_lines o WHERE o.request_line_id IS NOT NULL`,
  );
  const poAct = await scalar(
    client,
    `SELECT count(*)::text FROM erp_garage_proc_order_lines o
      WHERE o.request_line_id IS NOT NULL
        AND EXISTS (SELECT 1 FROM cashflow_forecast_lines l WHERE l.id = o.request_line_id)`,
  );
  eq('dòng PO còn nối được tới dòng dự chi', poExp, poAct);

  const channelMismatch = await scalar(
    client,
    `SELECT count(*)::text FROM cashflow_payments p
       JOIN kgara_cashflow_vouchers v ON 'PM-' || v.voucher_code = p.code
      WHERE p.channel <> ${channelFromLabel('v.payment_method')}`,
  );
  eq('kênh thanh toán khớp nhãn gốc (lệch)', '0', channelMismatch);

  const labelsExp = await scalar(
    client,
    `SELECT count(*)::text FROM kgara_cashflow_vouchers v
      WHERE ${voucherScope('v')} AND v.created_by IS NOT NULL`,
  );
  const labelsAct = await scalar(
    client,
    `SELECT count(*)::text FROM cashflow_garage_forecast_ext e
       JOIN kgara_cashflow_vouchers v ON v.id = e.forecast_id
      WHERE ${voucherScope('v')} AND e.legacy_created_by IS NOT NULL`,
  );
  eq('nhãn người tạo gốc đã điền đủ', labelsExp, labelsAct);

  return out;
}
