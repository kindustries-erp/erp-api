import { GarageProcurementRequestOrderRefService } from './garage-procurement-request-order-ref.service';

describe('GarageProcurementRequestOrderRefService', () => {
  it('không truy vấn khi danh sách id rỗng', async () => {
    const orders = { find: jest.fn() };
    const svc = new GarageProcurementRequestOrderRefService(orders as never);

    const out = await svc.forRequests([]);

    expect(orders.find).not.toHaveBeenCalled();
    expect(out.size).toBe(0);
  });

  it('gom PO theo requestId, bỏ dòng thiếu requestId, một query cho cả lô', async () => {
    const orders = {
      find: jest.fn().mockResolvedValue([
        { id: 'o1', orderNo: 'PO-1', status: 'ISSUED', requestId: 'r1' },
        { id: 'o2', orderNo: 'PO-2', status: 'DRAFT', requestId: 'r1' },
        { id: 'o3', orderNo: 'PO-3', status: 'DRAFT', requestId: null },
      ]),
    };
    const svc = new GarageProcurementRequestOrderRefService(orders as never);

    const out = await svc.forRequests(['r1', 'r1', 'r2']);

    expect(orders.find).toHaveBeenCalledTimes(1);
    expect(orders.find.mock.calls[0][0].where.isDeleted).toBe(false);
    expect(out.get('r1')).toEqual([
      { id: 'o1', orderNo: 'PO-1', status: 'ISSUED' },
      { id: 'o2', orderNo: 'PO-2', status: 'DRAFT' },
    ]);
    expect(out.has('r2')).toBe(false);
  });
});
