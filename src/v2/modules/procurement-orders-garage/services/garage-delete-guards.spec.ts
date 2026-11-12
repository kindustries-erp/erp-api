import { ConflictException } from '@nestjs/common';
import { GarageProcurementRequestCommandService } from '@/v2/modules/procurement-requests-garage/services/procurement-request-command.service';
import { GarageProcurementOrder } from '../entities/procurement-order.entity';
import { GarageProcurementOrderCommandService } from './procurement-order-command.service';

function fakeDataSource(count: number) {
  const manager = {
    findOne: jest.fn(async (_entity: unknown, _opts?: unknown) => {
      return Object.assign(new GarageProcurementOrder(), {
        id: 'o1',
        status: 'DRAFT',
        requestId: null,
        isDeleted: false,
      });
    }),
    find: jest.fn().mockResolvedValue([]),
    count: jest.fn().mockResolvedValue(count),
    save: jest.fn(async (_t: unknown, v: unknown) => v),
    delete: jest.fn().mockResolvedValue({}),
  };
  return {
    manager,
    dataSource: {
      transaction: async (cb: (m: unknown) => Promise<unknown>) => cb(manager),
    } as never,
  };
}

describe('Chặn xóa cứng của lớp con garage', () => {
  it('PO garage còn phiếu nhập tham chiếu thì chặn', async () => {
    const { dataSource, manager } = fakeDataSource(2);
    const svc = new GarageProcurementOrderCommandService(
      dataSource,
      {} as never,
      {} as never,
      {} as never,
    );

    await expect(svc.hardDeleteDraft('o1')).rejects.toThrow(ConflictException);
    expect(manager.count).toHaveBeenCalledWith(expect.anything(), {
      where: { garageProcurementOrderId: 'o1' },
    });
    expect(manager.delete).not.toHaveBeenCalled();
  });

  it('PO garage không còn phiếu nhập thì cho xóa cứng', async () => {
    const { dataSource, manager } = fakeDataSource(0);
    const svc = new GarageProcurementOrderCommandService(
      dataSource,
      {} as never,
      {} as never,
      {} as never,
    );

    await svc.hardDeleteDraft('o1');
    expect(manager.delete).toHaveBeenCalledTimes(2);
  });

  it('PO garage đã xóa mềm vẫn xóa cứng được (khóa dòng không lọc isDeleted)', async () => {
    const { dataSource, manager } = fakeDataSource(0);
    manager.findOne.mockImplementationOnce(async () =>
      Object.assign(new GarageProcurementOrder(), {
        id: 'o1',
        status: 'DRAFT',
        requestId: null,
        isDeleted: true,
      }),
    );
    const svc = new GarageProcurementOrderCommandService(
      dataSource,
      {} as never,
      {} as never,
      {} as never,
    );

    await svc.hardDeleteDraft('o1');
    expect(manager.findOne.mock.calls[0][1]).toEqual(
      expect.objectContaining({ where: { id: 'o1' } }),
    );
    expect(manager.delete).toHaveBeenCalledTimes(2);
  });

  it('PR garage còn đơn mua tham chiếu (kể cả đã xóa mềm) thì chặn', async () => {
    const { dataSource, manager } = fakeDataSource(1);
    const svc = new GarageProcurementRequestCommandService(
      dataSource,
      {} as never,
      {} as never,
    );

    await expect(svc.hardDeleteDraft('o1')).rejects.toThrow(ConflictException);
    expect(manager.count).toHaveBeenCalledWith(expect.anything(), {
      where: { requestId: 'o1' },
    });
    expect(manager.delete).not.toHaveBeenCalled();
  });
});
