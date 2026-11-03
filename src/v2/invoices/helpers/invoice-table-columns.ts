import { TableColumnMap } from '@/common/utils/table-query';
import { REMAINING_AMOUNT_SQL, NET_OFF_SUM_SQL } from './invoice-netoff.helper';

/**
 * Cột lọc, sắp xếp và tổng (whitelist, không nhận biểu thức từ client).
 * `partner` và `taxCode` đổi theo chiều: IN lấy người bán, OUT lấy người mua.
 */
export const INVOICE_TABLE_COLUMNS: TableColumnMap = {
  createdAt: { sql: 'e.createdAt', type: 'date' },
  created_at: { sql: 'e.createdAt', type: 'date' },
  invoiceNo: { sql: 'e.invoiceNo', type: 'text' },
  invoice_no: { sql: 'e.invoiceNo', type: 'text' },
  serialNo: { sql: 'e.serialNo', type: 'text' },
  serial_no: { sql: 'e.serialNo', type: 'text' },
  invoiceDate: { sql: 'e.invoiceDate', type: 'date' },
  invoice_date: { sql: 'e.invoiceDate', type: 'date' },
  direction: { sql: 'e.direction', type: 'text' },
  status: { sql: 'e.status', type: 'text' },
  sellerName: { sql: 'e.sellerName', type: 'text' },
  seller_name: { sql: 'e.sellerName', type: 'text' },
  sellerTaxCode: { sql: 'e.sellerTaxCode', type: 'text' },
  seller_tax_code: { sql: 'e.sellerTaxCode', type: 'text' },
  buyerName: { sql: 'e.buyerName', type: 'text' },
  buyer_name: { sql: 'e.buyerName', type: 'text' },
  buyerTaxCode: { sql: 'e.buyerTaxCode', type: 'text' },
  buyer_tax_code: { sql: 'e.buyerTaxCode', type: 'text' },
  partner: {
    sql: "CASE WHEN e.direction = 'OUT' THEN e.buyerName ELSE e.sellerName END",
    type: 'text',
  },
  taxCode: {
    sql: "CASE WHEN e.direction = 'OUT' THEN e.buyerTaxCode ELSE e.sellerTaxCode END",
    type: 'text',
  },
  description: { sql: 'e.description', type: 'text' },
  invoiceType: { sql: 'e.invoiceType', type: 'text' },
  invoice_type: { sql: 'e.invoiceType', type: 'text' },
  invoiceCategory: { sql: 'e.invoiceCategory', type: 'text' },
  invoice_category: { sql: 'e.invoiceCategory', type: 'text' },
  preVatAmount: { sql: 'e.preVatAmount', type: 'number' },
  pre_vat_amount: { sql: 'e.preVatAmount', type: 'number' },
  vatRate: { sql: 'e.vatRate', type: 'number' },
  vat_rate: { sql: 'e.vatRate', type: 'number' },
  vatAmount: { sql: 'e.vatAmount', type: 'number' },
  vat_amount: { sql: 'e.vatAmount', type: 'number' },
  discountAmount: { sql: 'e.discountAmount', type: 'number' },
  discount_amount: { sql: 'e.discountAmount', type: 'number' },
  totalAmount: { sql: 'e.totalAmount', type: 'number' },
  total_amount: { sql: 'e.totalAmount', type: 'number' },
  netOffAmount: { sql: NET_OFF_SUM_SQL, type: 'number' },
  remainingAmount: { sql: REMAINING_AMOUNT_SQL, type: 'number' },
  taxInvoiceStatus: { sql: 'e.taxInvoiceStatus', type: 'number' },
  taxProcessStatus: { sql: 'e.taxProcessStatus', type: 'number' },
  postingStatus: { sql: 'e.postingStatus', type: 'text' },
  // Alias theo key cột của bảng V2 (`posting`, `note`)
  posting: { sql: 'e.postingStatus', type: 'text' },
  note: { sql: 'e.notes', type: 'text' },
  settlementOrder: { sql: 'e.settlementOrder', type: 'text' },
  licensePlate: { sql: 'e.licensePlate', type: 'text' },
  notes: { sql: 'e.notes', type: 'text' },
};

/** Cột số được cộng vào `summaries` (tổng toàn bộ dòng khớp bộ lọc, trước khi phân trang). */
export const INVOICE_SUMMARY_COLUMNS: { key: string; sql: string }[] = [
  { key: 'preVatAmount', sql: 'e.preVatAmount' },
  { key: 'vatRate', sql: 'e.vatRate' },
  { key: 'vatAmount', sql: 'e.vatAmount' },
  { key: 'discountAmount', sql: 'e.discountAmount' },
  { key: 'totalAmount', sql: 'e.totalAmount' },
  { key: 'netOffAmount', sql: NET_OFF_SUM_SQL },
  { key: 'remainingAmount', sql: REMAINING_AMOUNT_SQL },
];

/** Cột dùng cho ô tìm kiếm chung (ILIKE, nhiều từ khóa cách nhau bằng dấu `;`). */
export const INVOICE_SEARCH_COLUMNS: string[] = [
  'e.invoiceNo',
  'e.serialNo',
  'e.invoiceDate',
  'e.direction',
  'e.status',
  'e.sellerName',
  'e.sellerTaxCode',
  'e.buyerName',
  'e.buyerTaxCode',
  'e.description',
  'e.invoiceType',
  'e.invoiceCategory',
  'e.notes',
];
