import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { AbstractPurchaseRequestCommandService } from '@/v2/core/procurement-requests-core/services/abstract-purchase-request-command.service';
import type { LinkSourceValues } from '@/v2/core/link-override-core';
import { ProcurementRequestBranchLinkSource } from '../link-sources/branch.link-source';
import { ProcurementRequestLinkEngine } from './procurement-request-link.engine';
import { GarageProcurementRequestCommandService } from './procurement-request-command.service';

const BRANCHES: Record<string, LinkSourceValues> = {
  b1: { branchName: 'Chi nhánh 1' },
  b2: { branchName: 'Chi nhánh 2' },
};

type Row = {
  id: string;
  branchId: string | null;
  branchName: string | null;
  sourceSnapshot: Record<string, unknown>;
  overrides: Record<string, true>;
};

function makeService(current: Partial<Row>, orderCount: number) {
  const row: Row = {
    id: 'r1',
    branchId: 'b1',
    branchName: 'Chi nhánh 1',
    sourceSnapshot: { branchName: 'Chi nhánh 1' },
    overrides: {},
    ...current,
  };
  const dataSource = {
    getRepository: jest.fn((entity: { name: string }) => {
      if (entity.name === 'GarageProcurementRequest') {
        return { findOne: jest.fn().mockResolvedValue(row) };
      }
      return { count: jest.fn().mockResolvedValue(orderCount) };
    }),
  };
  // Nguồn chi nhánh chỉ có findValues (đọc); mọi lần gọi được theo dõi để chứng minh không ghi nguồn.
  const findValues = jest.fn((id: string) =>
    Promise.resolve(BRANCHES[id] ?? null),
  );
  const links = new ProcurementRequestLinkEngine({
    findValues,
  } as unknown as ProcurementRequestBranchLinkSource);
  const svc = new GarageProcurementRequestCommandService(
    dataSource as never,
    {} as never,
    { resolveLines: jest.fn() } as never,
    links,
  );
  return { svc, findValues };
}

describe('GarageProcurementRequestCommandService.updateHeader - chi nhánh liên kết', () => {
  let parentUpdate: jest.SpyInstance;

  beforeEach(() => {
    parentUpdate = jest
      .spyOn(AbstractPurchaseRequestCommandService.prototype, 'updateHeader')
      .mockResolvedValue({} as never);
  });

  afterEach(() => {
    parentUpdate.mockRestore();
  });

  it('từ chối đổi chi nhánh khi đề nghị đã có đơn mua (409), không đọc nguồn', async () => {
    const { svc, findValues } = makeService({}, 1);
    await expect(svc.updateHeader('r1', { branchId: 'b2' })).rejects.toThrow(
      ConflictException,
    );
    expect(parentUpdate).not.toHaveBeenCalled();
    expect(findValues).not.toHaveBeenCalled();
  });

  it('đổi chi nhánh khi chưa có đơn mua: lập snapshot mới, tên điền từ chi nhánh, không override', async () => {
    const { svc } = makeService({}, 0);
    await svc.updateHeader('r1', { branchId: 'b2' });
    expect(parentUpdate).toHaveBeenCalledWith(
      'r1',
      {
        branchId: 'b2',
        branchName: 'Chi nhánh 2',
        sourceSnapshot: { branchName: 'Chi nhánh 2' },
        overrides: {},
      },
      undefined,
    );
  });

  it('đổi chi nhánh kèm tên khác nguồn: đánh dấu override và giữ tên đã sửa', async () => {
    const { svc } = makeService({}, 0);
    await svc.updateHeader('r1', { branchId: 'b2', branchName: 'Tên riêng' });
    expect(parentUpdate).toHaveBeenCalledWith(
      'r1',
      expect.objectContaining({
        branchName: 'Tên riêng',
        sourceSnapshot: { branchName: 'Chi nhánh 2' },
        overrides: { branchName: true },
      }),
      undefined,
    );
  });

  it('chi nhánh mới không tồn tại: 404, không ghi', async () => {
    const { svc } = makeService({}, 0);
    await expect(svc.updateHeader('r1', { branchId: 'zzz' })).rejects.toThrow(
      NotFoundException,
    );
    expect(parentUpdate).not.toHaveBeenCalled();
  });

  it('bỏ liên kết chi nhánh: xóa snapshot và override, giữ tên tự do', async () => {
    const { svc } = makeService({}, 0);
    await svc.updateHeader('r1', { branchId: null, branchName: 'Tự nhập' });
    expect(parentUpdate).toHaveBeenCalledWith(
      'r1',
      {
        branchId: null,
        branchName: 'Tự nhập',
        sourceSnapshot: {},
        overrides: {},
      },
      undefined,
    );
  });

  it('chỉ sửa branchName: đánh dấu override, không đọc nguồn và không đụng branchId', async () => {
    const { svc, findValues } = makeService({}, 3);
    await svc.updateHeader('r1', { branchName: 'Sửa tên' });
    expect(findValues).not.toHaveBeenCalled();
    expect(parentUpdate).toHaveBeenCalledWith(
      'r1',
      {
        branchName: 'Sửa tên',
        sourceSnapshot: { branchName: 'Chi nhánh 1' },
        overrides: { branchName: true },
      },
      undefined,
    );
  });

  it('sửa branchName về đúng tên nguồn: bỏ dấu override', async () => {
    const { svc } = makeService(
      {
        branchName: 'Sửa tên',
        overrides: { branchName: true },
      },
      0,
    );
    await svc.updateHeader('r1', { branchName: 'Chi nhánh 1' });
    expect(parentUpdate).toHaveBeenCalledWith(
      'r1',
      expect.objectContaining({ overrides: {} }),
      undefined,
    );
  });

  it('dòng cũ chưa có snapshot: lập snapshot từ chi nhánh rồi so với tên đang lưu', async () => {
    const { svc, findValues } = makeService(
      { sourceSnapshot: {}, branchName: 'Tên cũ gõ tay' },
      0,
    );
    await svc.updateHeader('r1', { branchName: 'Tên mới' });
    expect(findValues).toHaveBeenCalledWith('b1');
    expect(parentUpdate).toHaveBeenCalledWith(
      'r1',
      expect.objectContaining({
        sourceSnapshot: { branchName: 'Chi nhánh 1' },
        overrides: { branchName: true },
      }),
      undefined,
    );
  });

  it('không chặn khi branchId không đổi dù đã có đơn mua', async () => {
    const { svc } = makeService({}, 2);
    await svc.updateHeader('r1', { branchId: 'b1', remarks: 'ghi chú' });
    expect(parentUpdate).toHaveBeenCalledWith(
      'r1',
      { branchId: 'b1', remarks: 'ghi chú' },
      undefined,
    );
  });

  it('patch không liên quan chi nhánh: chuyển thẳng xuống lõi, không đọc DB/nguồn', async () => {
    const { svc, findValues } = makeService({}, 5);
    await svc.updateHeader('r1', { remarks: 'ghi chú' });
    expect(parentUpdate).toHaveBeenCalledWith(
      'r1',
      { remarks: 'ghi chú' },
      undefined,
    );
    expect(findValues).not.toHaveBeenCalled();
  });

  it('truyền manager của orchestrator xuống lõi để cùng transaction', async () => {
    const { svc } = makeService({}, 0);
    const manager = { getRepository: jest.fn() } as never;
    await svc.updateHeader('r1', { remarks: 'x' }, manager);
    expect(parentUpdate).toHaveBeenCalledWith('r1', { remarks: 'x' }, manager);
  });
});

describe('GarageProcurementRequestCommandService - revert/refresh field liên kết', () => {
  let parentUpdate: jest.SpyInstance;

  beforeEach(() => {
    parentUpdate = jest
      .spyOn(AbstractPurchaseRequestCommandService.prototype, 'updateHeader')
      .mockResolvedValue({} as never);
  });

  afterEach(() => {
    parentUpdate.mockRestore();
    BRANCHES.b1 = { branchName: 'Chi nhánh 1' };
  });

  const edited = {
    branchName: 'Sửa tên',
    overrides: { branchName: true as const },
  };

  it('revert đưa branchName về snapshot đã lưu, bỏ dấu override, không đọc nguồn', async () => {
    const { svc, findValues } = makeService(edited, 0);
    await svc.revertLink('r1', 'branchName');
    expect(findValues).not.toHaveBeenCalled();
    expect(parentUpdate).toHaveBeenCalledWith(
      'r1',
      { branchName: 'Chi nhánh 1', overrides: {} },
      undefined,
    );
  });

  it('revert/refresh từ chối field không được hỗ trợ (400)', async () => {
    const { svc } = makeService(edited, 0);
    await expect(svc.revertLink('r1', 'title')).rejects.toThrow(
      BadRequestException,
    );
    await expect(svc.refreshLink('r1', 'branchId')).rejects.toThrow(
      BadRequestException,
    );
    expect(parentUpdate).not.toHaveBeenCalled();
  });

  it('refresh đọc lại chi nhánh, lấy tên mới nhất và làm mới snapshot', async () => {
    BRANCHES.b1 = { branchName: 'Tên mới của chi nhánh' };
    const { svc, findValues } = makeService(edited, 0);
    await svc.refreshLink('r1', 'branchName');
    expect(findValues).toHaveBeenCalledWith('b1');
    expect(parentUpdate).toHaveBeenCalledWith(
      'r1',
      {
        branchName: 'Tên mới của chi nhánh',
        sourceSnapshot: { branchName: 'Tên mới của chi nhánh' },
        overrides: {},
      },
      undefined,
    );
  });

  it('refresh khi chưa liên kết chi nhánh: 409', async () => {
    const { svc } = makeService({ branchId: null }, 0);
    await expect(svc.refreshLink('r1', 'branchName')).rejects.toThrow(
      ConflictException,
    );
  });
});

describe('GarageProcurementRequestCommandService.createDraft - chi nhánh liên kết', () => {
  let parentCreate: jest.SpyInstance;
  const actor = { id: 'u1', roles: [] };
  const lines = [] as never;

  beforeEach(() => {
    parentCreate = jest
      .spyOn(AbstractPurchaseRequestCommandService.prototype, 'createDraft')
      .mockResolvedValue({} as never);
  });

  afterEach(() => {
    parentCreate.mockRestore();
  });

  it('có branchId: điền tên chi nhánh, lập snapshot, override rỗng', async () => {
    const { svc } = makeService({}, 0);
    await svc.createDraft(
      actor,
      { requestDate: '2026-11-23', branchId: 'b2' },
      lines,
    );
    expect(parentCreate).toHaveBeenCalledWith(
      actor,
      expect.objectContaining({
        branchId: 'b2',
        branchName: 'Chi nhánh 2',
        sourceSnapshot: { branchName: 'Chi nhánh 2' },
        overrides: {},
      }),
      lines,
      undefined,
    );
  });

  it('có branchId và tên khác nguồn: giữ tên đã sửa, đánh dấu override', async () => {
    const { svc } = makeService({}, 0);
    await svc.createDraft(
      actor,
      { requestDate: '2026-11-23', branchId: 'b1', branchName: 'Tên riêng' },
      lines,
    );
    expect(parentCreate).toHaveBeenCalledWith(
      actor,
      expect.objectContaining({
        branchName: 'Tên riêng',
        overrides: { branchName: true },
      }),
      lines,
      undefined,
    );
  });

  it('không có branchId: giữ nguyên input, không đọc nguồn', async () => {
    const { svc, findValues } = makeService({}, 0);
    const input = { requestDate: '2026-11-23', branchName: 'Tự nhập' };
    await svc.createDraft(actor, input, lines);
    expect(parentCreate).toHaveBeenCalledWith(actor, input, lines, undefined);
    expect(findValues).not.toHaveBeenCalled();
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
      {} as never,
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
