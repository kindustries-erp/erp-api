import { EntityManager } from 'typeorm';
import { Logger } from '@nestjs/common';
import { extractNetPayableAmount } from '../utils/kgara-parser.util';

const logger = new Logger('KgaraCaseNetoffSyncHelper');

/**
 * Đồng bộ hai chiều giữa cấn trừ Hóa đơn (erp_invoice_voucher_netoff)
 * và Sổ thanh toán Vụ việc Garage (kgara_case_settlements).
 *
 * Tuân thủ quy chuẩn Pattern C (/api-service-refactor):
 * - Pure Engine / Helper độc lập, nhận EntityManager
 * - Không phụ thuộc NestJS Container hay state
 * - Thao tác nguyên khối (atomic) trong transaction hiện tại
 */

/**
 * Đồng bộ toàn bộ cấn trừ sao kê của Hóa đơn sang các Vụ việc Garage liên kết.
 */
export async function syncInvoiceNetOffToCaseSettlements(
  manager: EntityManager,
  invoiceId: string,
): Promise<void> {
  if (!invoiceId) return;

  try {
    // 1. Tìm danh sách Vụ việc liên kết (qua kgara_case_linked_invoice HOẶC settlement_order)
    const linkedCases = await manager.query(
      `SELECT DISTINCT c.id, c.so_chung_tu
       FROM kgara_cases c
       LEFT JOIN kgara_case_linked_invoice l ON l."caseDbId" = c.id
       JOIN erp_invoices i ON (l."invoiceId" = i.id OR c.so_chung_tu = i.settlement_order)
       WHERE i.id = $1 AND c.kgara_deleted_at IS NULL`,
      [invoiceId],
    );

    if (!linkedCases || linkedCases.length === 0) return;

    for (const c of linkedCases) {
      await syncSingleCaseSettlementsFromInvoiceNetOffs(
        manager,
        c.id,
        c.so_chung_tu,
      );
    }
  } catch (err: any) {
    logger.warn(
      `Lỗi khi đồng bộ cấn trừ từ Hóa đơn ${invoiceId} sang Vụ việc: ${err?.message}`,
    );
  }
}

/**
 * Đồng bộ lại toàn bộ settlements cho một Vụ việc cụ thể từ tất cả các Hóa đơn liên kết của nó.
 */
export async function syncSingleCaseSettlementsFromInvoiceNetOffs(
  manager: EntityManager,
  caseId: string,
  soChungTu?: string | null,
): Promise<void> {
  if (!caseId) return;

  try {
    // 1. Lấy thông tin case hiện tại
    const caseRows = await manager.query(
      `SELECT id, so_chung_tu, tien_co_thue, doanh_thu, raw_data
       FROM kgara_cases
       WHERE id = $1 LIMIT 1`,
      [caseId],
    );
    if (!caseRows || caseRows.length === 0) return;
    const caseRecord = caseRows[0];
    const caseCode = soChungTu || caseRecord.so_chung_tu || '';

    // 2. Gom toàn bộ cấn trừ sao kê từ tất cả Hóa đơn đang liên kết với Vụ việc này
    const netOffRows = await manager.query(
      `SELECT 
         n.bank_transaction_id,
         SUM(n.net_off_amount) as total_net_off,
         t.trans_date,
         COALESCE(t.correspondent_name, i.buyer_name, i.seller_name) as partner_name,
         t.description,
         i.direction
       FROM erp_invoice_voucher_netoff n
       JOIN erp_invoices i ON i.id = n.invoice_id
       LEFT JOIN erp_bank_transactions t ON t.id = n.bank_transaction_id
       WHERE n.invoice_id IN (
         SELECT DISTINCT l."invoiceId" 
         FROM kgara_case_linked_invoice l 
         WHERE l."caseDbId" = $1
         UNION
         SELECT id 
         FROM erp_invoices 
         WHERE settlement_order = $2 AND is_deleted = false AND $2 <> ''
       )
       GROUP BY n.bank_transaction_id, t.trans_date, t.correspondent_name, i.buyer_name, i.seller_name, t.description, i.direction`,
      [caseId, caseCode],
    );

    const activeTxnIds: string[] = [];

    // 3. Upsert từng giao dịch sao kê vào kgara_case_settlements
    for (const row of netOffRows) {
      if (!row.bank_transaction_id) continue;
      activeTxnIds.push(row.bank_transaction_id);

      const isOut = (row.direction || 'OUT') === 'OUT';
      const targetSettlementType = isOut ? 'RECEIPT' : 'PAYMENT';
      const netOffAmount = Number(row.total_net_off || 0);

      const existingSettlement = await manager.query(
        `SELECT id FROM kgara_case_settlements 
         WHERE case_id = $1 AND bank_transaction_id = $2 LIMIT 1`,
        [caseId, row.bank_transaction_id],
      );

      if (existingSettlement && existingSettlement.length > 0) {
        await manager.query(
          `UPDATE kgara_case_settlements 
           SET amount = $1, 
               settlement_type = $2, 
               trans_date = $3, 
               partner_name = $4, 
               updated_at = now() 
           WHERE id = $5`,
          [
            netOffAmount,
            targetSettlementType,
            row.trans_date || null,
            row.partner_name || null,
            existingSettlement[0].id,
          ],
        );
      } else {
        await manager.query(
          `INSERT INTO kgara_case_settlements 
           (id, case_id, bank_transaction_id, settlement_type, source_channel, amount, trans_date, partner_name, note, created_at, updated_at)
           VALUES (gen_random_uuid(), $1, $2, $3, 'ON_SYSTEM', $4, $5, $6, 'Đồng bộ cấn trừ từ hóa đơn liên kết', now(), now())`,
          [
            caseId,
            row.bank_transaction_id,
            targetSettlementType,
            netOffAmount,
            row.trans_date || null,
            row.partner_name || null,
          ],
        );
      }
    }

    // 4. Dọn dẹp các settlements ON_SYSTEM kế thừa từ HĐ mà giao dịch sao kê không còn nữa
    const inheritCondition = `(
      category = 'AUTO_NETOFF_INVOICE'
      OR note LIKE '%hóa đơn liên kết%'
      OR note LIKE '%Cấn trừ tự động từ HĐ%'
    )`;

    if (activeTxnIds.length > 0) {
      await manager.query(
        `DELETE FROM kgara_case_settlements
         WHERE case_id = $1 
           AND source_channel = 'ON_SYSTEM'
           AND ${inheritCondition}
           AND (bank_transaction_id IS NULL OR NOT (bank_transaction_id = ANY($2::uuid[])))`,
        [caseId, activeTxnIds],
      );
    } else {
      await manager.query(
        `DELETE FROM kgara_case_settlements
         WHERE case_id = $1 
           AND source_channel = 'ON_SYSTEM'
           AND ${inheritCondition}`,
        [caseId],
      );
    }

    // 5. Cập nhật lại số dư công nợ của Vụ việc theo chuẩn Pure Cashflow
    const settlementSums = await manager.query(
      `SELECT COALESCE(SUM(amount), 0) as total_receipts
       FROM kgara_case_settlements
       WHERE case_id = $1 AND settlement_type = 'RECEIPT'`,
      [caseId],
    );

    const totalReceipts = Number(settlementSums[0]?.total_receipts || 0);
    const targetRevenue = extractNetPayableAmount({
      tienCoThue: caseRecord.tien_co_thue,
      rawData: caseRecord.raw_data,
      doanhThu: caseRecord.doanh_thu,
    });
    const remainingReceivable = Math.max(0, targetRevenue - totalReceipts);

    await manager.query(
      `UPDATE kgara_cases
       SET tien_co_thue = $1,
           tien_da_thanh_toan = $2,
           tien_con_phai_thanh_toan = $3,
           updated_at = now()
       WHERE id = $4`,
      [targetRevenue, totalReceipts, remainingReceivable, caseId],
    );
  } catch (err: any) {
    logger.warn(
      `Lỗi khi tính toán lại settlements cho Vụ việc ${caseId}: ${err?.message}`,
    );
  }
}
