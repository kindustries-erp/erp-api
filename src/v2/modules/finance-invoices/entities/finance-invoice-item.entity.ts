import { Entity } from 'typeorm';
import { BaseInvoiceItemEntity } from '@/v2/core/invoices';

/**
 * Entity FinanceInvoiceItem trỏ bảng `erp_invoice_items`.
 * Kế thừa toàn bộ cấu trúc cột từ BaseInvoiceItemEntity.
 */
@Entity({ name: 'erp_invoice_items' })
export class FinanceInvoiceItem extends BaseInvoiceItemEntity {}

export { FinanceInvoiceItem as InvoiceItem };
