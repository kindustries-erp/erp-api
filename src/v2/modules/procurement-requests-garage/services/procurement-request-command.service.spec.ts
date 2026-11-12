import { ConflictException } from '@nestjs/common';
import { AbstractPurchaseRequestCommandService } from '@/v2/core/procurement-requests-core/services/abstract-purchase-request-command.service';
import { GarageProcurementRequestCommandService } from './procurement-request-command.service';

function makeService(currentBranch: string | null, orderCount: number) {
  const dataSource = {
    getRepository: jest.fn((entity: { name: string }) => {
      if (entity.name === 'GarageProcurementRequest') {
        return {
          findOne: jest
            .fn()
            .mockResolvedValue({ id: 'r1', branchId: currentBranch }),
        };
      }
      return { count: jest.fn().mockResolvedValue(orderCount) };
    }),
  };
  const svc = new GarageProcurementRequestCommandService(
    dataSource as never,
    {} as never,
    { resolveLines: jest.fn() } as never,
  );
  return { svc };
}

describe('GarageProcurementRequestCommandService.updateHeader - đổi chi nhánh', () => {
  let parentUpdate: jest.SpyInstance;

  beforeEach(() => {
    parentUpdate = jest
      .spyOn(AbstractPurchaseRequestCommandService.prototype, 'updateHeader')
      .mockResolvedValue({} as never);
  });

  afterEach(() => {
    parentUpdate.mockRestore();
  });

  it('từ chối đổi chi nhánh khi đề nghị đã có đơn mua', async () => {
    const { svc } = makeService('b1', 1);
    await expect(svc.updateHeader('r1', { branchId: 'b2' })).rejects.toThrow(
      ConflictException,
    );
    expect(parentUpdate).not.toHaveBeenCalled();
  });

  it('cho phép đổi chi nhánh khi chưa có đơn mua', async () => {
    const { svc } = makeService('b1', 0);
    await svc.updateHeader('r1', { branchId: 'b2' });
    expect(parentUpdate).toHaveBeenCalledWith(
      'r1',
      { branchId: 'b2' },
      undefined,
    );
  });

  it('cho phép bỏ trống chi nhánh khi chưa có đơn mua', async () => {
    const { svc } = makeService('b1', 0);
    await svc.updateHeader('r1', { branchId: null });
    expect(parentUpdate).toHaveBeenCalledWith(
      'r1',
      { branchId: null },
      undefined,
    );
  });

  it('không chặn khi chi nhánh không đổi dù đã có đơn mua', async () => {
    const { svc } = makeService('b1', 2);
    await svc.updateHeader('r1', { branchId: 'b1', remarks: 'ghi chú' });
    expect(parentUpdate).toHaveBeenCalled();
  });

  it('không kiểm tra đơn mua khi patch không có branchId', async () => {
    const { svc } = makeService('b1', 5);
    await svc.updateHeader('r1', { remarks: 'ghi chú' });
    expect(parentUpdate).toHaveBeenCalledWith(
      'r1',
      { remarks: 'ghi chú' },
      undefined,
    );
  });

  it('truyền manager của orchestrator xuống lõi để cùng transaction', async () => {
    const { svc } = makeService('b1', 0);
    const manager = { getRepository: jest.fn() } as never;
    await svc.updateHeader('r1', { remarks: 'x' }, manager);
    expect(parentUpdate).toHaveBeenCalledWith('r1', { remarks: 'x' }, manager);
  });
});

describe('GarageProcurementRequestCommandService.prepareLines - chuẩn hóa mã hàng', () => {
  it('đưa dòng qua resolver danh mục (cho tạo mã) trong transaction đang chạy', async () => {
    const resolved = [{ itemCode: 'PT-000001' }];
    const resolver = { resolveLines: jest.fn().mockResolvedValue(resolved) };
    const svc = new GarageProcurementRequestCommandService(
      {} as never,
      {} as never,
      resolver as never,
    );
    const manager = {} as never;
    const lines = [{ itemName: 'Lọc dầu' }] as never;

    const result = await (
      svc as unknown as {
        prepareLines(m: unknown, l: unknown): Promise<unknown>;
      }
    ).prepareLines(manager, lines);

    expect(resolver.resolveLines).toHaveBeenCalledWith(manager, lines);
    expect(result).toBe(resolved);
  });
});
