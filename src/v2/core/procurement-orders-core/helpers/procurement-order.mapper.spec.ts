import { toProcurementOrderResponse } from './procurement-order.mapper';

describe('toProcurementOrderResponse', () => {
  it('đổi số chuỗi sang number, giữ liên kết PR, không lộ createdBy', () => {
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
    expect(out).not.toHaveProperty('createdBy');
  });
});
