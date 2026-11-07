import { BadRequestException, ConflictException } from '@nestjs/common';
import { LegacyPurchaseRequestWriteService } from './legacy-purchase-request-write.service';

interface FakeHeader {
  id: string;
  status: string;
  createdBy: string | null;
  approverId: string | null;
  isDeleted: boolean;
  kind: string;
}

function setup(opts: {
  header?: Partial<FakeHeader> | null;
  lines?: Array<{ qtyRequested: string; qtyOrdered: string }>;
  poCount?: number;
}) {
  const header: FakeHeader | null =
    opts.header === null
      ? null
      : {
          id: 'f1',
          status: 'DRAFT',
          createdBy: 'u1',
          approverId: null,
          isDeleted: false,
          kind: 'PURCHASE',
          ...opts.header,
        };
  const manager = {
    findOne: jest.fn().mockResolvedValue(header),
    find: jest.fn().mockResolvedValue(opts.lines ?? []),
    update: jest.fn().mockResolvedValue({ affected: 1 }),
    delete: jest.fn().mockResolvedValue({ affected: 1 }),
    save: jest.fn(async (_t: unknown, v: unknown) => v),
    create: jest.fn((_t: unknown, v: object) => v),
    getRepository: jest.fn(),
    query: jest.fn(async (sql: string) => {
      if (sql.includes('erp_garage_proc_orders'))
        return [{ n: opts.poCount ?? 0 }];
      return [];
    }),
  };
  const dataSource = {
    transaction: jest.fn(async (fn: (m: unknown) => unknown) => fn(manager)),
  };
  const events = { record: jest.fn().mockResolvedValue(undefined) };
  const svc = new LegacyPurchaseRequestWriteService(
    dataSource as never,
    events as never,
  );
  return { svc, manager, events };
}

describe('LegacyPurchaseRequestWriteService', () => {
  it('createDraft từ chối khi không có dòng nào', async () => {
    const { svc } = setup({});
    await expect(
      svc.createDraft(
        { id: 'u1', roles: [] },
        { requestDate: '2026-11-07' },
        [],
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('updateHeader chỉ ghi các trường được truyền', async () => {
    const { svc, manager } = setup({});
    await svc.updateHeader('f1', { title: 'Mua bugi' });
    expect(manager.update).toHaveBeenCalledWith(
      expect.anything(),
      { id: 'f1' },
      { title: 'Mua bugi' },
    );
  });

  it('updateHeader bị chặn khi không còn nháp', async () => {
    const { svc } = setup({ header: { status: 'OPEN' } });
    await expect(svc.updateHeader('f1', { title: 'x' })).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('replaceDraftLines chỉ khi nháp, và cập nhật tổng dự kiến', async () => {
    const { svc, manager } = setup({});
    await svc.replaceDraftLines('f1', [
      { lineType: 'GOODS', qtyRequested: 2, estUnitPrice: 100 },
    ]);
    expect(manager.update).toHaveBeenCalledWith(
      expect.anything(),
      { id: 'f1' },
      { amount: '200' },
    );
  });

  it('replaceDraftLines bị chặn khi đã duyệt', async () => {
    const { svc } = setup({ header: { status: 'OPEN' } });
    await expect(
      svc.replaceDraftLines('f1', [{ lineType: 'GOODS', qtyRequested: 1 }]),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('softDeleteDraft bị chặn khi đã có số lượng được đơn mua giữ', async () => {
    const { svc } = setup({ lines: [{ qtyRequested: '5', qtyOrdered: '2' }] });
    await expect(svc.softDeleteDraft('f1')).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('softDeleteDraft đánh dấu isDeleted khi chưa có đơn mua giữ', async () => {
    const { svc, manager } = setup({
      lines: [{ qtyRequested: '5', qtyOrdered: '0' }],
    });
    await svc.softDeleteDraft('f1');
    expect(manager.update).toHaveBeenCalledWith(
      expect.anything(),
      { id: 'f1' },
      { isDeleted: true },
    );
  });

  it('hardDeleteDraft bị chặn khi còn đơn mua tham chiếu', async () => {
    const { svc, manager } = setup({ poCount: 1 });
    await expect(svc.hardDeleteDraft('f1')).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(manager.delete).not.toHaveBeenCalled();
  });

  it('hardDeleteDraft xóa dòng rồi đề nghị khi không có đơn mua', async () => {
    const { svc, manager } = setup({ poCount: 0 });
    await svc.hardDeleteDraft('f1');
    expect(manager.delete).toHaveBeenCalledTimes(2);
  });

  it('không tìm thấy đề nghị khi không phải PURCHASE hoặc đã xóa', async () => {
    const { svc } = setup({ header: null });
    await expect(svc.softDeleteDraft('f1')).rejects.toThrow('Không tìm thấy');
  });
});
