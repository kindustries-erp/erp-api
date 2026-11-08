import {
  BaseInvoiceLineResponseDto,
  BaseInvoiceResponseDto,
} from '@/v2/core/invoices-core';

export class FinanceInvoiceLineResponseDto extends BaseInvoiceLineResponseDto {}
export class FinanceInvoiceResponseDto extends BaseInvoiceResponseDto {}

export {
  FinanceInvoiceLineResponseDto as InvoiceItemResponseDto,
  FinanceInvoiceResponseDto as InvoiceResponseDto,
};
