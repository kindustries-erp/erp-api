import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { CaseOrigin, CaseStatus } from '../entities/case-garage.enums';
import { CaseCommandService } from './case-command.service';

jest.mock('@/common/numbering/document-numbering', () => ({
  nextDocumentNo: jest.fn().mockResolvedValue('VV-20261119-001'),
}));

const make = (current: Record<string, unknown> | null) => {
  const manager = {
    findOne: jest.fn().mockResolvedValue(current),
    findOneOrFail: jest.fn().mockResolvedValue({ id: 'c1' }),
    create: jest.fn((_e: unknown, v: unknown) => v),
    save: jest.fn(async (_e: unknown, v: Record<string, unknown>) => ({
      id: 'c1',
      ...v,
    })),
    update: jest.fn().mockResolvedValue(undefined),
    query: jest.fn().mockResolvedValue([{ exists: 1 }]),
  };
  const ds = { transaction: (cb: (m: unknown) => unknown) => cb(manager) };
  const lines = { replaceAll: jest.fn(), recompute: jest.fn() };
  const svc = new CaseCommandService(ds as never, lines as never);
  return { svc, manager, lines };
};

const owned = (origin: CaseOrigin, status = CaseStatus.INTAKE) => ({
  id: 'c1',
  origin,
  status,
  branchId: 'B1',
  accountKey: 'MAIN',
});

describe('CaseCommandService', () => {
  it('create: NATIVE, chi nhánh ERP từ tham số, không có UUID KGara, tự sinh mã, ghi dòng', async () => {
    const { svc, manager, lines } = make(null);
    await svc.create(
      'B1',
      { licensePlate: '30A-1', services: [{ productCode: 'X' }] } as never,
      'u1',
    );
    const created = manager.create.mock.calls[0][1] as Record<string, unknown>;
    expect(created).toMatchObject({
      origin: CaseOrigin.NATIVE,
      branchId: 'B1',
      branchExternalId: null,
      accountKey: 'MAIN',
      caseCode: 'VV-20261119-001',
      status: CaseStatus.INTAKE,
      createdBy: 'u1',
    });
    expect(lines.replaceAll).toHaveBeenCalledTimes(1);
  });

  it('create: không chọn chi nhánh → branchId null', async () => {
    const { svc, manager } = make(null);
    await svc.create(undefined, { licensePlate: '30A-1' } as never, 'u1');
    expect(manager.create.mock.calls[0][1]).toMatchObject({
      branchId: null,
      branchExternalId: null,
    });
  });

  it('create: trùng mã → 409', async () => {
    const { svc, manager } = make(null);
    manager.save.mockRejectedValueOnce({ code: '23505' });
    await expect(
      svc.create('B1', { licensePlate: 'x', caseCode: 'A' } as never, 'u1'),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('create: chi nhánh không tồn tại → 400, không lưu', async () => {
    const { svc, manager } = make(null);
    manager.query.mockResolvedValueOnce([]);
    await expect(
      svc.create('B-x', { licensePlate: 'x' } as never, 'u1'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(manager.save).not.toHaveBeenCalled();
  });

  it('cách ly chi nhánh: có chọn chi nhánh thì where có branchId, không thấy → 404', async () => {
    const { svc, manager } = make(null);
    await expect(
      svc.update('B2', 'c1', { licensePlate: 'x' } as never),
    ).rejects.toBeInstanceOf(NotFoundException);
    const where = (
      manager.findOne.mock.calls[0][1] as { where: Record<string, unknown> }
    ).where;
    expect(where).toMatchObject({
      id: 'c1',
      branchId: 'B2',
      isDeleted: false,
    });
    expect(where).not.toHaveProperty('branchExternalId');
  });

  it('không chọn chi nhánh: where không lọc chi nhánh', async () => {
    const { svc, manager } = make(owned(CaseOrigin.NATIVE));
    await svc.update(undefined, 'c1', { licensePlate: 'x' } as never);
    const where = (
      manager.findOne.mock.calls[0][1] as { where: Record<string, unknown> }
    ).where;
    expect(where).not.toHaveProperty('branchId');
    expect(where).not.toHaveProperty('branchExternalId');
  });

  it('update NATIVE: ghi field và thay dòng', async () => {
    const { svc, manager, lines } = make(owned(CaseOrigin.NATIVE));
    await svc.update('B1', 'c1', { licensePlate: 'N', services: [] } as never);
    expect(manager.update).toHaveBeenCalledWith(
      expect.anything(),
      { id: 'c1' },
      expect.objectContaining({ licensePlate: 'N' }),
    );
    expect(lines.replaceAll).toHaveBeenCalled();
  });

  it('update SYNC: định danh → 400; field nguồn KGara ghi cột hiệu lực + overrides, không ghi ngược V1', async () => {
    const a = make(owned(CaseOrigin.KGARA_SYNC));
    await expect(
      a.svc.update('B1', 'c1', { caseCode: 'x' } as never),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(a.manager.update).not.toHaveBeenCalled();

    const b = make({
      ...owned(CaseOrigin.KGARA_SYNC),
      sourceSnapshot: { licensePlate: '30A-1' },
      overrides: {},
    });
    await b.svc.update('B1', 'c1', { licensePlate: '29B-2' } as never);
    expect(b.manager.update).toHaveBeenCalledTimes(1);
    expect(b.manager.update).toHaveBeenCalledWith(
      expect.anything(),
      { id: 'c1' },
      { licensePlate: '29B-2', overrides: { licensePlate: true } },
    );
    expect(b.lines.replaceAll).not.toHaveBeenCalled();
  });

  it('update SYNC: sửa về đúng giá trị KGara thì bỏ dấu override', async () => {
    const c = make({
      ...owned(CaseOrigin.KGARA_SYNC),
      sourceSnapshot: { licensePlate: '30A-1' },
      overrides: { licensePlate: true },
    });
    await c.svc.update('B1', 'c1', { licensePlate: '30A-1' } as never);
    expect(c.manager.update).toHaveBeenCalledWith(
      expect.anything(),
      { id: 'c1' },
      { licensePlate: '30A-1', overrides: {} },
    );
  });

  it('update xe tài khoản OJ: đổi phân loại khác OJ → 400, không ghi; sửa field khác vẫn được', async () => {
    const oj = {
      ...owned(CaseOrigin.KGARA_SYNC),
      accountKey: 'OJ',
      sourceSnapshot: {},
      overrides: {},
    };
    const a = make(oj);
    await expect(
      a.svc.update('B1', 'c1', { classification: 'BH' } as never),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(a.manager.update).not.toHaveBeenCalled();

    const b = make(oj);
    await b.svc.update('B1', 'c1', { licensePlate: '29B-2' } as never);
    expect(b.manager.update).toHaveBeenCalledTimes(1);
  });

  it('softDelete: đặt isDeleted cho cả xe NATIVE và xe sync', async () => {
    for (const origin of [CaseOrigin.NATIVE, CaseOrigin.KGARA_SYNC]) {
      const a = make(owned(origin));
      await a.svc.softDelete('B1', 'c1');
      expect(a.manager.update).toHaveBeenCalledWith(
        expect.anything(),
        { id: 'c1' },
        { isDeleted: true },
      );
    }
  });

  it('updateStatus: chuyển hợp lệ ok, không hợp lệ → 400, SYNC ghi đè ở v2', async () => {
    const ok = make(owned(CaseOrigin.NATIVE));
    await ok.svc.updateStatus('B1', 'c1', CaseStatus.QUOTED);
    expect(ok.manager.update).toHaveBeenCalledWith(
      expect.anything(),
      { id: 'c1' },
      expect.objectContaining({ status: 'QUOTED', kgaraStatusCode: 1 }),
    );
    const bad = make(owned(CaseOrigin.NATIVE));
    await expect(
      bad.svc.updateStatus('B1', 'c1', CaseStatus.COMPLETED),
    ).rejects.toBeInstanceOf(BadRequestException);
    const sync = make({
      ...owned(CaseOrigin.KGARA_SYNC),
      sourceSnapshot: { status: 'INTAKE' },
      overrides: {},
    });
    await sync.svc.updateStatus('B1', 'c1', CaseStatus.QUOTED);
    expect(sync.manager.update).toHaveBeenCalledWith(
      expect.anything(),
      { id: 'c1' },
      { status: 'QUOTED', overrides: { status: true } },
    );
  });

  it('updateStatus: xe ERP mở lại từ Hoàn thành bỏ completedAt cũ; xe KGara giữ giá trị nguồn', async () => {
    const native = make({
      ...owned(CaseOrigin.NATIVE),
      status: CaseStatus.COMPLETED,
      completedAt: new Date('2026-11-20T10:00:00.000Z'),
    });
    await native.svc.updateStatus('B1', 'c1', CaseStatus.IN_PROGRESS);
    expect(native.manager.update).toHaveBeenCalledWith(
      expect.anything(),
      { id: 'c1' },
      expect.objectContaining({ status: 'IN_PROGRESS', completedAt: null }),
    );
    const sync = make({
      ...owned(CaseOrigin.KGARA_SYNC),
      status: CaseStatus.COMPLETED,
      completedAt: new Date('2026-11-20T10:00:00.000Z'),
      sourceSnapshot: { status: 'COMPLETED' },
      overrides: {},
    });
    await sync.svc.updateStatus('B1', 'c1', CaseStatus.IN_PROGRESS);
    expect(sync.manager.update).toHaveBeenCalledWith(
      expect.anything(),
      { id: 'c1' },
      { status: 'IN_PROGRESS', overrides: { status: true } },
    );
  });

  it('updateStatus: xe sync lùi QUOTED → INTAKE, giữ trạng thái KGara; xe NATIVE bị chặn', async () => {
    const sync = make({
      ...owned(CaseOrigin.KGARA_SYNC, CaseStatus.QUOTED),
      kgaraStatusCode: 1,
      sourceSnapshot: { status: 'QUOTED' },
      overrides: {},
    });
    await sync.svc.updateStatus('B1', 'c1', CaseStatus.INTAKE);
    const patch = sync.manager.update.mock.calls[0][2] as Record<
      string,
      unknown
    >;
    expect(patch).toEqual({ status: 'INTAKE', overrides: { status: true } });
    expect(patch).not.toHaveProperty('kgaraStatusCode');

    const native = make(owned(CaseOrigin.NATIVE, CaseStatus.QUOTED));
    await expect(
      native.svc.updateStatus('B1', 'c1', CaseStatus.INTAKE),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(native.manager.update).not.toHaveBeenCalled();
  });

  it('updateStatus: đóng công đoạn đang mở và bỏ status nhỏ không thuộc status mới', async () => {
    const current = {
      ...owned(CaseOrigin.NATIVE, CaseStatus.IN_PROGRESS),
      progressStage: 'READY_FOR_DELIVERY',
    };
    const open = {
      id: 'log-1',
      startedAt: new Date('2020-01-01T00:00:00Z'),
    };
    const { svc, manager } = make(current);
    manager.findOne.mockImplementation((entity: { name: string }) =>
      Promise.resolve(entity.name === 'CaseProgressLogGarage' ? open : current),
    );
    await svc.updateStatus('B1', 'c1', CaseStatus.COMPLETED, 'u9');
    const byTarget = (name: string) =>
      manager.update.mock.calls.filter(
        (c) => (c[0] as { name: string }).name === name,
      );
    const [closeCall] = byTarget('CaseProgressLogGarage');
    expect(closeCall[1]).toEqual({ id: 'log-1' });
    expect(closeCall[2]).toMatchObject({ updatedBy: 'u9' });
    expect((closeCall[2] as { endedAt: Date }).endedAt).toBeInstanceOf(Date);
    expect(byTarget('CaseGarage')).toContainEqual([
      expect.anything(),
      { id: 'c1' },
      { progressStage: null },
    ]);
  });

  it('updateStatus: status nhỏ vẫn hợp lệ hoặc không có công đoạn mở thì không đổi thêm', async () => {
    const current = {
      ...owned(CaseOrigin.KGARA_SYNC, CaseStatus.INTAKE),
      progressStage: null,
      sourceSnapshot: {},
      overrides: {},
    };
    const { svc, manager } = make(current);
    manager.findOne.mockImplementation((entity: { name: string }) =>
      Promise.resolve(entity.name === 'CaseProgressLogGarage' ? null : current),
    );
    await svc.updateStatus('B1', 'c1', CaseStatus.QUOTED);
    expect(manager.update).toHaveBeenCalledTimes(1);
  });

  it('updateStatus: xe sync đổi về đúng trạng thái KGara thì bỏ dấu override', async () => {
    const sync = make({
      ...owned(CaseOrigin.KGARA_SYNC, CaseStatus.INTAKE),
      sourceSnapshot: { status: 'QUOTED' },
      overrides: { status: true },
    });
    await sync.svc.updateStatus('B1', 'c1', CaseStatus.QUOTED);
    expect(sync.manager.update).toHaveBeenCalledWith(
      expect.anything(),
      { id: 'c1' },
      { status: 'QUOTED', overrides: {} },
    );
  });
});
