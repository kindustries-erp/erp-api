import { GarageProcurementOrderRequestRefService } from './garage-procurement-order-request-ref.service';

describe('GarageProcurementOrderRequestRefService', () => {
  it('không truy vấn khi không có id', async () => {
    const requests = { find: jest.fn() };
    const svc = new GarageProcurementOrderRequestRefService(requests as never);

    const out = await svc.requestNos([]);

    expect(requests.find).not.toHaveBeenCalled();
    expect(out.size).toBe(0);
  });

  it('trả requestNo theo id, không lọc đề nghị đã xóa mềm', async () => {
    const requests = {
      find: jest.fn().mockResolvedValue([
        { id: 'r1', requestNo: 'DNM-1' },
        { id: 'r2', requestNo: 'DNM-2' },
      ]),
    };
    const svc = new GarageProcurementOrderRequestRefService(requests as never);

    const out = await svc.requestNos(['r1', 'r2', 'r1']);

    expect(requests.find.mock.calls[0][0].where.isDeleted).toBeUndefined();
    expect(out.get('r1')).toBe('DNM-1');
    expect(out.get('r2')).toBe('DNM-2');
  });
});
