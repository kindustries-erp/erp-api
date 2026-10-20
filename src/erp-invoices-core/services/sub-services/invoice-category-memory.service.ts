import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { ClassifyInvoiceCategoryResult } from '../../../ai-hub-core/handlers/invoice-ai.handler';
import { VINFAST_TAX_CODES } from '../../../ai-hub-core/handlers/invoice/invoice-ai.constants';
import { pickDominantCategory } from '../../helpers/invoice-category-memory.helper';
import { ErpInvoice } from '../../entities/erp_invoice.entity';

/**
 * Nhớ danh mục theo MST người bán từ chính lịch sử hóa đơn đã phân loại (kể cả anh sửa tay),
 * để hóa đơn mới của người bán quen thuộc không cần gọi AI. Tắt bằng INVOICE_CATEGORY_MEMORY=off.
 */
@Injectable()
export class InvoiceCategoryMemoryService {
  private readonly logger = new Logger(InvoiceCategoryMemoryService.name);

  constructor(
    @InjectRepository(ErpInvoice)
    private readonly invoiceRepo: Repository<ErpInvoice>,
  ) {}

  async recall(
    sellerTaxCode?: string | null,
  ): Promise<ClassifyInvoiceCategoryResult | null> {
    if (process.env.INVOICE_CATEGORY_MEMORY === 'off') return null;

    const mst = String(sellerTaxCode || '')
      .replace(/\s+/g, '')
      .trim();
    // MST VinFast đã có luật khớp trực tiếp trong handler
    if (!mst || VINFAST_TAX_CODES.includes(mst)) return null;

    try {
      const rows: Array<{ category_code: string; n: number | string }> =
        await this.invoiceRepo.manager.query(
          `SELECT c.code AS category_code, COUNT(*)::int AS n
             FROM erp_invoices i
             JOIN erp_module_categories c ON c.id = i.category_id
            WHERE i.direction = 'IN' AND i.is_deleted = false
              AND i.seller_tax_code = $1
              AND c.module_key = 'INVOICE' AND c.is_deleted = false
            GROUP BY c.code`,
          [mst],
        );
      const dominant = pickDominantCategory(rows);
      if (!dominant) return null;

      return {
        categoryCode: dominant.categoryCode,
        confidence: 0.95,
        reason: `Theo lịch sử người bán MST ${mst}: ${dominant.count}/${dominant.total} hóa đơn thuộc ${dominant.categoryCode}`,
        fromMemory: true,
      };
    } catch (err: any) {
      // Bộ nhớ chỉ là tối ưu: lỗi thì để AI xử lý như bình thường
      this.logger.warn(
        `Seller memory lookup failed for MST ${mst}: ${err?.message}`,
      );
      return null;
    }
  }
}
