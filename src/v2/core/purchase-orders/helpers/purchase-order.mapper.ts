import { BasePurchaseOrderResponseDto } from '../dto/base-purchase-order-response.dto';

/** Trạng thái hiển thị nhận hàng, khớp toCoreDocument của v1. Nguồn duy nhất. */
export function deriveInventoryStatus(
  status: string,
): 'RECEIVED' | 'PARTIAL_RECEIVED' | 'NOT_RECEIVED' {
  if (status === 'RECEIVED' || status === 'FULLY_RECEIVED') return 'RECEIVED';
  if (status === 'PARTIAL_RECEIVED') return 'PARTIAL_RECEIVED';
  return 'NOT_RECEIVED';
}

export interface PurchaseOrderHeaderLike {
  id: string;
  poNo: string;
  supplierId: string | null;
  supplierName?: string | null;
  supplier?: { name?: string | null } | null;
  orderDate: Date;
  expectedDate: Date | null;
  status: string;
  paymentStatus: string;
  remarks: string | null;
  supplierInvoiceNo: string | null;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PurchaseOrderLineLike {
  id: string;
  lineNo: number;
  itemId: string | null;
  itemCode: string | null;
  itemName: string | null;
  description: string | null;
  qtyOrdered: string | number | null;
  qtyReceived: string | number | null;
  unitPrice: string | number | null;
  amount: string | number | null;
}

export interface PurchaseOrderMapOptions {
  /** Tổng do module ghi sẵn (garage). Bỏ trống thì cộng từ các dòng (core). */
  totalAmount?: number;
}

const toNumericString = (value: string | number | null | undefined) =>
  value === null || value === undefined ? null : String(value);

/**
 * Entity → response DTO. Hàm thuần: không đụng DB, không lộ entity.
 * Hình dạng khớp toCoreDocument của v1 (camelCase, số dạng chuỗi).
 */
export function toPurchaseOrderResponse(
  header: PurchaseOrderHeaderLike,
  lines: PurchaseOrderLineLike[] = [],
  options: PurchaseOrderMapOptions = {},
): BasePurchaseOrderResponseDto {
  const mappedLines = lines.map((line) => ({
    id: line.id,
    lineNo: line.lineNo,
    itemId: line.itemId ?? null,
    itemCode: line.itemCode ?? null,
    itemName: line.itemName ?? null,
    description: line.description ?? null,
    qtyOrdered: toNumericString(line.qtyOrdered) ?? '0',
    qtyReceived: toNumericString(line.qtyReceived) ?? '0',
    unitPrice: toNumericString(line.unitPrice),
    amount: toNumericString(line.amount),
  }));

  const computedTotal =
    Math.round(
      mappedLines.reduce((sum, line) => sum + Number(line.amount || 0), 0) *
        1000,
    ) / 1000;

  return {
    id: header.id,
    poNo: header.poNo,
    supplierId: header.supplierId ?? null,
    supplierName: header.supplier?.name ?? header.supplierName ?? null,
    orderDate: header.orderDate,
    expectedDate: header.expectedDate ?? null,
    status: header.status,
    paymentStatus: header.paymentStatus,
    remarks: header.remarks ?? null,
    supplierInvoiceNo: header.supplierInvoiceNo ?? null,
    createdBy: header.createdBy ?? null,
    totalAmount: options.totalAmount ?? computedTotal,
    inventoryStatus: deriveInventoryStatus(header.status),
    createdAt: header.createdAt,
    updatedAt: header.updatedAt,
    lines: mappedLines,
  };
}
