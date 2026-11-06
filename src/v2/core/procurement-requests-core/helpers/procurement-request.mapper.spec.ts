import { toPurchaseRequestResponse } from './procurement-request.mapper';

const header = {
  id: 'h1',
  requestNo: 'DNM-20261105-001',
  requestDate: '2026-11-05',
  neededDate: null,
  title: 'Mua văn phòng phẩm',
  requesterEmployeeId: null,
  status: 'DRAFT',
  orderingStatus: 'NONE',
  estimatedTotal: '150.50',
  remarks: null,
  submittedBy: null,
  approvedBy: null,
  rejectedBy: null,
  rejectReason: null,
  cancelReason: null,
  closeReason: null,
};

describe('toPurchaseRequestResponse', () => {
  it('chuyển số dạng chuỗi sang number và sắp dòng theo lineNo', () => {
    const out = toPurchaseRequestResponse(header, [
      {
        id: 'l2',
        lineNo: 2,
        lineType: 'SERVICE',
        itemId: null,
        itemCode: null,
        itemName: 'Vệ sinh',
        description: null,
        qtyRequested: '1',
        qtyOrdered: '0',
        estUnitPrice: null,
        estAmount: null,
        notes: null,
      },
      {
        id: 'l1',
        lineNo: 1,
        lineType: 'GOODS',
        itemId: 'i1',
        itemCode: 'A',
        itemName: 'Giấy',
        description: null,
        qtyRequested: '3',
        qtyOrdered: '1',
        estUnitPrice: '50',
        estAmount: '150',
        notes: null,
      },
    ]);
    expect(out.estimatedTotal).toBe(150.5);
    expect(out.lines.map((l) => l.id)).toEqual(['l1', 'l2']);
    expect(out.lines[0]).toMatchObject({
      qtyRequested: 3,
      qtyOrdered: 1,
      estUnitPrice: 50,
      estAmount: 150,
    });
    expect(out.lines[1].estUnitPrice).toBeNull();
  });

  it('không lộ trường nội bộ của entity', () => {
    const out = toPurchaseRequestResponse(
      { ...header, createdBy: 'u1', isDeleted: false } as never,
      [],
    ) as unknown as Record<string, unknown>;
    expect(out).not.toHaveProperty('isDeleted');
    expect(out).not.toHaveProperty('createdBy');
  });
});
