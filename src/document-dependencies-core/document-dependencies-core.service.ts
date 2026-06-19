import { Injectable, ConflictException } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class DocumentDependenciesCoreService {
  constructor(private readonly dataSource: DataSource) {}

  /**
   * General purpose method to check if a document is linked/used by downstream documents.
   * Throws ConflictException('DOCUMENT_IN_USE') if dependencies exist.
   * @param moduleName The identifier of the module/table, e.g., 'purchase_orders', 'payment_vouchers'.
   * @param documentId The UUID of the document.
   */
  async checkDependencies(
    moduleName: string,
    documentId: string,
  ): Promise<void> {
    const dependencies: string[] = [];

    if (moduleName === 'purchase_orders') {
      // Check Goods Receipts
      const grs = await this.dataSource.query(
        `SELECT DISTINCT gr.receipt_no 
         FROM public.erp_goods_receipt_lines grl
         JOIN public.erp_goods_receipts gr ON grl.goods_receipt_id = gr.id
         JOIN public.purchase_order_lines pol ON grl.purchase_order_line_id = pol.id
         WHERE pol.purchase_order_id = $1`,
        [documentId],
      );
      if (grs.length > 0) {
        dependencies.push(...grs.map((r) => `Phiếu nhập kho: ${r.receipt_no}`));
      }

      // Check Payment Vouchers (through document_payment_links)
      const payments = await this.dataSource.query(
        `SELECT DISTINCT pv.voucher_no 
         FROM public.document_payment_links dpl
         JOIN public.payment_vouchers pv ON dpl.payment_voucher_id = pv.id
         WHERE dpl.document_type = 'purchase_orders' AND dpl.document_id = $1`,
        [documentId],
      );
      if (payments.length > 0) {
        dependencies.push(
          ...payments.map((r) => `Phiếu thanh toán: ${r.voucher_no}`),
        );
      }
    } else if (moduleName === 'sales_service_orders') {
      // Check Payment Vouchers
      const payments = await this.dataSource.query(
        `SELECT DISTINCT pv.voucher_no 
         FROM public.document_payment_links dpl
         JOIN public.payment_vouchers pv ON dpl.payment_voucher_id = pv.id
         WHERE dpl.document_type = 'sales_service_orders' AND dpl.document_id = $1`,
        [documentId],
      );
      if (payments.length > 0) {
        dependencies.push(
          ...payments.map((r) => `Phiếu thanh toán: ${r.voucher_no}`),
        );
      }

      // Check Inventory Transactions (Goods Issues)
      const issues = await this.dataSource.query(
        `SELECT DISTINCT gi.issue_no 
         FROM public.erp_goods_issue_lines gil
         JOIN public.erp_goods_issues gi ON gil.goods_issue_id = gi.id
         JOIN public.sales_service_order_lines sol ON gil.sales_order_line_id = sol.id
         WHERE sol.order_id = $1`,
        [documentId],
      );
      if (issues.length > 0) {
        dependencies.push(
          ...issues.map((r) => `Phiếu xuất kho: ${r.issue_no}`),
        );
      }
    } else if (moduleName === 'payment_vouchers') {
      // payment_vouchers do not typically have downstream user documents
      // their own side effects (journal entries, ledger settlements) are reversed internally.
    } else if (moduleName === 'goods_receipts') {
      // usually goods receipts don't have downstream documents.
      // journal entries are reversed internally.
    } else if (moduleName === 'goods_issues') {
      // journal entries are reversed internally.
    }

    if (dependencies.length > 0) {
      throw new ConflictException({
        code: 'DOCUMENT_IN_USE',
        message: 'Chứng từ đã được sử dụng ở các giao dịch khác.',
        dependencies,
      });
    }
  }
}
