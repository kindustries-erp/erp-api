import {
  deriveInventoryStatus,
  PurchaseOrderHeaderLike,
  PurchaseOrderLineLike,
  toPurchaseOrderResponse,
} from './purchase-order.mapper';

/**
 * Fixture và kỳ vọng bám theo toCoreDocument của v1
 * (purchase-orders-core.service.ts, hàm private toCoreDocument):
 * supplierName = supplier.name || supplierName; totalAmount = tổng amount dòng;
 * inventoryStatus theo status; số dạng chuỗi; lines giữ thứ tự.
 */
const header: PurchaseOrderHeaderLike = {
  id: '11111111-1111-1111-1111-111111111111',
  poNo: 'PO-20261104-001',
  supplierId: '22222222-2222-2222-2222-222222222222',
  supplierName: null,
  supplier: { name: 'NCC Hoàng Gia' },
  orderDate: new Date('2026-11-04T00:00:00.000Z'),
  expectedDate: null,
  status: 'CONFIRMED',
  paymentStatus: 'UNPAID',
  remarks: null,
  supplierInvoiceNo: null,
  createdBy: null,
  createdAt: new Date('2026-11-04T01:00:00.000Z'),
  updatedAt: new Date('2026-11-04T01:00:00.000Z'),
};

const lines: PurchaseOrderLineLike[] = [
  {
    id: 'l1',
    lineNo: 1,
    itemId: null,
    itemCode: 'DAU-01',
    itemName: 'Dầu nhớt',
    description: null,
    qtyOrdered: '2.000',
    qtyReceived: '0',
    unitPrice: '1500.000',
    amount: '3000.000',
  },
  {
    id: 'l2',
    lineNo: 2,
    itemId: null,
    itemCode: null,
    itemName: 'Lọc gió',
    description: 'Lọc gió loại A',
    qtyOrdered: 1,
    qtyReceived: 0,
    unitPrice: null,
    amount: null,
  },
];

describe('toPurchaseOrderResponse (parity với v1 toCoreDocument)', () => {
  it('lấy supplierName từ quan hệ supplier trước, rồi tới supplierName', () => {
    expect(toPurchaseOrderResponse(header, lines).supplierName).toBe(
      'NCC Hoàng Gia',
    );
    const noRelation = { ...header, supplier: null, supplierName: 'Tên lưu' };
    expect(toPurchaseOrderResponse(noRelation, lines).supplierName).toBe(
      'Tên lưu',
    );
  });

  it('totalAmount = tổng amount các dòng (dòng null tính 0)', () => {
    expect(toPurchaseOrderResponse(header, lines).totalAmount).toBe(3000);
  });

  it('ưu tiên totalAmount do module ghi sẵn (garage)', () => {
    expect(
      toPurchaseOrderResponse(header, lines, { totalAmount: 9999 }).totalAmount,
    ).toBe(9999);
  });

  it('số lượng và đơn giá là chuỗi, null giữ null', () => {
    const [first, second] = toPurchaseOrderResponse(header, lines).lines;
    expect(first.qtyOrdered).toBe('2.000');
    expect(first.unitPrice).toBe('1500.000');
    expect(second.qtyOrdered).toBe('1');
    expect(second.qtyReceived).toBe('0');
    expect(second.unitPrice).toBeNull();
    expect(second.amount).toBeNull();
  });

  it('giữ thứ tự dòng và trả paymentStatus, createdBy', () => {
    const response = toPurchaseOrderResponse(
      { ...header, createdBy: 'user-1' },
      lines,
    );
    expect(response.lines.map((l) => l.lineNo)).toEqual([1, 2]);
    expect(response.paymentStatus).toBe('UNPAID');
    expect(response.createdBy).toBe('user-1');
  });

  it('không trả entity: không có quan hệ supplier trong response', () => {
    const response = toPurchaseOrderResponse(header, lines);
    expect(response).not.toHaveProperty('supplier');
  });
});

describe('deriveInventoryStatus', () => {
  it('khớp v1: RECEIVED và FULLY_RECEIVED là RECEIVED', () => {
    expect(deriveInventoryStatus('RECEIVED')).toBe('RECEIVED');
    expect(deriveInventoryStatus('FULLY_RECEIVED')).toBe('RECEIVED');
  });

  it('PARTIAL_RECEIVED và trạng thái khác', () => {
    expect(deriveInventoryStatus('PARTIAL_RECEIVED')).toBe('PARTIAL_RECEIVED');
    expect(deriveInventoryStatus('APPROVED')).toBe('NOT_RECEIVED');
    expect(deriveInventoryStatus('DRAFT')).toBe('NOT_RECEIVED');
  });
});
