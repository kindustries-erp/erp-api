import { toPurchaseRequestResponse } from './procurement-request.mapper';

const header = {
  id: 'h1',
  extraData: {},
  requestNo: 'DNM-20261105-001',
  requestDate: '2026-11-05',
  neededDate: null,
  title: 'Mua văn phòng phẩm',
  requesterEmployeeId: null,
  status: 'DRAFT',
  orderingStatus: 'NONE',
  estimatedTotal: '150.50',
  remarks: null,
  createdBy: 'u1',
  approverId: null,
  submittedBy: null,
  submittedAt: null,
  approvedBy: null,
  approvedAt: null,
  rejectedBy: null,
  rejectedAt: null,
  rejectReason: null,
  cancelledBy: null,
  cancelledAt: null,
  cancelReason: null,
  closedBy: null,
  closedAt: null,
  closeReason: null,
};

describe('toPurchaseRequestResponse', () => {
  it('chuyển số dạng chuỗi sang number và sắp dòng theo lineNo', () => {
    const out = toPurchaseRequestResponse(header, [
      {
        id: 'l2',
        extraData: {},
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
        extraData: {},
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
    expect(out.createdBy).toBe('u1');
  });
  it('createdBy là id người tạo, null khi header không có', () => {
    const out = toPurchaseRequestResponse(
      { ...header, createdBy: null } as never,
      [],
    );
    expect(out.createdBy).toBeNull();
  });
  it('gắn email qua emailOf cho createdByEmail và approval, mặc định null', () => {
    const lookup = (id: string | null | undefined) =>
      id === 'u1' ? 'a@x.vn' : id === 'u2' ? 'b@x.vn' : null;
    const withPeople = toPurchaseRequestResponse(
      {
        ...header,
        approverId: 'u2',
        submittedBy: 'u1',
        submittedAt: new Date('2026-11-05T01:00:00Z'),
      } as never,
      [],
      lookup,
    );
    expect(withPeople.createdByEmail).toBe('a@x.vn');
    expect(withPeople.approval.approverEmail).toBe('b@x.vn');
    expect(withPeople.approval.submit?.byEmail).toBe('a@x.vn');
    const without = toPurchaseRequestResponse({ ...header } as never, []);
    expect(without.createdByEmail).toBeNull();
    expect(without.approval.approverEmail).toBeNull();
  });

  it('shape approval luôn có đủ 7 bước, PR có issue = null', () => {
    const out = toPurchaseRequestResponse({ ...header } as never, []);
    expect(Object.keys(out.approval).sort()).toEqual(
      [
        'approverEmail',
        'approverId',
        'approve',
        'cancel',
        'close',
        'issue',
        'reject',
        'submit',
      ].sort(),
    );
    expect(out.approval.issue).toBeNull();
  });

  it('truyền relatedOrders khi có; chi tiết không truyền thì để undefined', () => {
    const related = [{ id: 'o1', orderNo: 'PO-1', status: 'ISSUED' }];

    expect(
      toPurchaseRequestResponse(header, [], () => null, related).relatedOrders,
    ).toEqual(related);
    expect(toPurchaseRequestResponse(header, []).relatedOrders).toBeUndefined();
  });
});
