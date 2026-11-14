import type {
  StockVoucherUnionColumns,
  StockVoucherUnionSource,
} from '@/v2/core/inventory-movements-core';

const STOCK_VOUCHER_COLUMNS: StockVoucherUnionColumns = {
  id: 'id',
  voucherNo: 'voucher_no',
  voucherDate: 'voucher_date',
  status: 'status',
  partnerName: 'partner_name',
  branchId: 'branch_id',
  totalAmount: 'total_amount',
  remarks: 'remarks',
  createdAt: 'created_at',
};

/** Bốn nguồn chứng từ kho Garage gộp vào danh sách. Tên bảng lấy từ migration, không từ request. */
export const GARAGE_STOCK_VOUCHER_SOURCES: StockVoucherUnionSource[] = [
  {
    type: 'PURCHASE_RECEIPT',
    table: 'goods_receipts_garage',
    columns: {
      ...STOCK_VOUCHER_COLUMNS,
      voucherNo: 'receipt_no',
      voucherDate: 'receipt_date',
      partnerName: 'supplier_name',
    },
  },
  {
    type: 'OTHER_RECEIPT',
    table: 'garage_stock_receipts',
    columns: STOCK_VOUCHER_COLUMNS,
  },
  {
    type: 'ISSUE',
    table: 'garage_stock_issues',
    columns: STOCK_VOUCHER_COLUMNS,
  },
  {
    type: 'ADJUSTMENT',
    table: 'garage_stock_adjustments',
    columns: STOCK_VOUCHER_COLUMNS,
  },
];
