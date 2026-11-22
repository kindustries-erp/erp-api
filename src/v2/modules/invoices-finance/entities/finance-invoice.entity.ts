import { Entity } from 'typeorm';
import { BaseInvoiceEntity } from '@/v2/core/invoices-core';

/**
 * Entity FinanceInvoice trỏ bảng `erp_invoices`.
 * Kế thừa toàn bộ cấu trúc cột từ BaseInvoiceEntity.
 */
@Entity({ name: 'erp_invoices' })
export class FinanceInvoice extends BaseInvoiceEntity {}

export { FinanceInvoice as Invoice };
