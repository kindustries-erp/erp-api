import { EntityManager } from 'typeorm';
import {
  sourcePaymentStatus,
  toCents,
} from '@/v2/core/cashflow-core/services/cashflow-payment-request.rules';

/**
 * Cập nhật trạng thái thanh toán của đơn mua garage và phân bổ vào dự chi PR nguồn.
 * Chạy trong cùng transaction với thao tác chi/hủy chi (SQL thô, theo cách của lớp tương thích).
 */

/** Số tiền đã chi (xu, chỉ thực chi POSTED) cho một đơn mua, từ mọi đề nghị. */
export async function paidCentsForPo(
  manager: EntityManager,
  poId: string,
): Promise<number> {
  const rows = await manager.query(
    `SELECT coalesce(sum(lp.amount), 0)::text AS s
       FROM cashflow_payment_request_line_payments lp
       JOIN cashflow_payment_request_lines l ON l.id = lp.line_id
       JOIN cashflow_payments p ON p.id = lp.payment_id
      WHERE l.ref_type = 'GARAGE_PO' AND l.ref_id = $1 AND p.status = 'POSTED'`,
    [poId],
  );
  return toCents(rows[0].s);
}

/** Đặt payment_status của đơn mua theo tổng đã chi so với trần (approved_total hoặc total_amount). */
export async function syncPurchaseOrderPaymentStatus(
  manager: EntityManager,
  poId: string,
): Promise<string> {
  const [po] = await manager.query(
    `SELECT approved_total::text AS approved, total_amount::text AS total
       FROM erp_garage_proc_orders WHERE id = $1 FOR UPDATE`,
    [poId],
  );
  if (!po) throw new Error(`Không tìm thấy đơn mua ${poId}`);
  const capCents = toCents(po.approved ?? po.total);
  const status = sourcePaymentStatus(
    capCents,
    await paidCentsForPo(manager, poId),
  );
  await manager.query(
    `UPDATE erp_garage_proc_orders SET payment_status = $2, updated_at = now() WHERE id = $1`,
    [poId, status],
  );
  return status;
}

/**
 * Phân bổ phần chi của một đơn mua vào dự chi PR nguồn (nếu có), không vượt phần còn lại của PR.
 * Phần vượt dự toán PR vẫn được chi, chỉ không ghi vào phân bổ.
 */
export async function allocateToSourceRequest(
  manager: EntityManager,
  poId: string,
  paymentId: string,
  amountCents: number,
  actorId: string | null,
): Promise<number> {
  if (amountCents <= 0) return 0;
  const [po] = await manager.query(
    `SELECT request_id FROM erp_garage_proc_orders WHERE id = $1`,
    [poId],
  );
  if (!po?.request_id) return 0;
  const prId = po.request_id as string;

  const [pr] = await manager.query(
    `SELECT amount::text AS amount FROM cashflow_forecasts WHERE id = $1 FOR UPDATE`,
    [prId],
  );
  if (!pr) return 0;
  const [used] = await manager.query(
    `SELECT coalesce(sum(amount), 0)::text AS s FROM cashflow_allocations WHERE forecast_id = $1`,
    [prId],
  );
  const room = Math.max(0, toCents(pr.amount) - toCents(used.s));
  const take = Math.min(room, amountCents);
  if (take <= 0) return 0;
  await manager.query(
    `INSERT INTO cashflow_allocations (payment_id, forecast_id, amount, created_by)
     VALUES ($1, $2, $3, $4)`,
    [paymentId, prId, (take / 100).toFixed(2), actorId],
  );
  return take;
}
