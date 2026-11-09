import { toProcurementOrderResponse } from './procurement-order.mapper';

describe('toProcurementOrderResponse', () => {
  it('đổi số chuỗi sang number, giữ liên kết PR, trả createdBy id', () => {
    const out = toProcurementOrderResponse(
      {
        id: 'o1',
        orderNo: 'DMH-20261105-001',
        orderDate: '2026-11-05',
        expectedDate: null,
        supplierId: 's1',
        supplierName: 'NCC A',
        sourceType: 'REQUEST',
        requestId: 'pr1',
        status: 'APPROVED',
        fulfillmentStatus: 'NONE',
        totalAmount: '250.00',
        approvedTotal: '250.00',
        remarks: null,
        rejectReason: null,
        cancelReason: null,
        closeReason: null,
        ...({ createdBy: 'u1' } as object),
      } as never,
      [
        {
          id: 'l1',
          extraData: {},
          lineNo: 1,
          lineType: 'GOODS',
          itemId: 'i1',
          itemCode: 'A',
          itemName: 'Giấy',
          description: null,
          qtyOrdered: '5',
          qtyFulfilled: '0',
          unitPrice: '50',
          amount: '250',
          requestLineId: 'rl1',
        },
      ],
    );
    expect(out.totalAmount).toBe(250);
    expect(out.approvedTotal).toBe(250);
    expect(out.lines[0]).toMatchObject({
      qtyOrdered: 5,
      unitPrice: 50,
      amount: 250,
      requestLineId: 'rl1',
    });
    expect(out.createdBy).toBe('u1');
  });

  it('trả approval và createdByEmail qua emailOf, không còn key phẳng cũ', () => {
    const at = new Date('2026-11-05T02:00:00Z');
    const header = {
      id: 'o1',
      extraData: {},
      orderNo: 'DMH-1',
      orderDate: '2026-11-05',
      expectedDate: null,
      supplierId: null,
      supplierName: null,
      sourceType: 'DIRECT' as const,
      requestId: null,
      status: 'CLOSED',
      fulfillmentStatus: 'PARTIAL',
      totalAmount: '100',
      approvedTotal: '100',
      remarks: null,
      createdBy: 'u1',
      approverId: 'u2',
      submittedBy: 'u1',
      submittedAt: at,
      approvedBy: 'u2',
      approvedAt: at,
      rejectedBy: null,
      rejectedAt: null,
      rejectReason: null,
      cancelledBy: null,
      cancelledAt: null,
      cancelReason: null,
      closedBy: null,
      closedAt: at,
      closeReason: null,
      issuedBy: 'u2',
      issuedAt: at,
    };
    const emailOf = (id: string | null | undefined) =>
      id === 'u1' ? 'a@x.vn' : id === 'u2' ? 'b@x.vn' : null;
    const out = toProcurementOrderResponse(header, [], emailOf);
    expect(out.createdByEmail).toBe('a@x.vn');
    expect(out.approval.approverEmail).toBe('b@x.vn');
    expect(out.approval.approve).toEqual({ by: 'u2', byEmail: 'b@x.vn', at });
    expect(out.approval.issue?.by).toBe('u2');
    expect(out.approval.close).toEqual({
      by: null,
      byEmail: null,
      at,
      reason: null,
    });
    expect(out).not.toHaveProperty('approverId');
    expect(out).not.toHaveProperty('rejectReason');
    expect(out).not.toHaveProperty('closeReason');
  });
});
