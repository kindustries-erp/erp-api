import {
  parseFilterRecord,
  TableColumnMap,
  TableFilterPayload,
} from '@/common/utils/table-query';

/**
 * Cột lưới đơn mua Garage (V2). Khóa khớp `key` của `procurementOrderColumns` phía web.
 * Biểu thức SQL trỏ vào alias `h` của header.
 */
export const TABLE_COLUMNS: TableColumnMap = {
  orderNo: { sql: 'h.orderNo', type: 'text' },
  orderDate: { sql: 'h.orderDate', type: 'date' },
  supplierName: { sql: 'h.supplierName', type: 'text' },
  branchName: { sql: 'h.branchName', type: 'text' },
  totalAmount: { sql: 'h.totalAmount', type: 'number' },
  status: { sql: 'h.status', type: 'status' },
  fulfillmentStatus: { sql: 'h.fulfillmentStatus', type: 'status' },
  paymentStatus: { sql: 'h.paymentStatus', type: 'status' },
  supplierInvoiceNo: { sql: 'h.supplierInvoiceNo', type: 'text' },
  /** Người tạo lưu uuid; lọc, sắp xếp và gợi ý đều dùng email từ core_users. */
  createdBy: {
    sql: '(SELECT cu.email FROM core_users cu WHERE cu.id = h.createdBy)',
    type: 'text',
  },
  createdAt: { sql: 'h.createdAt', type: 'date' },
};

/** Cột áp dụng từ khóa tìm kiếm (giữ đúng hành vi cũ: số đơn và tên NCC). */
export const SEARCH_COLUMNS = ['h.orderNo', 'h.supplierName'];

/** Chuyển raw filter JSON thành envelope TableFilterPayload cho options query. */
export function toFilterPayload(raw: unknown): TableFilterPayload {
  const parsed = parseFilterRecord<
    TableFilterPayload & Record<string, unknown>
  >(raw);
  if (!parsed) return {};
  const hasEnvelope = [
    'columnFilters',
    'columnSearch',
    'columnOperators',
    'dateRanges',
  ].some((key) => key in parsed);
  return hasEnvelope
    ? parsed
    : { columnFilters: parsed as Record<string, string[]> };
}
