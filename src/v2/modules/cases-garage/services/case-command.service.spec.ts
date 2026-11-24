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
  branchExternalId: 'B1',
  accountKey: 'MAIN',
});

describe('CaseCommandService', () => {
  it('create: NATIVE, chi nhánh từ tham số, tự sinh mã, ghi dòng', async () => {
    const { svc, manager, lines } = make(null);
    await svc.create(
      'B1',
      { licensePlate: '30A-1', services: [{ productCode: 'X' }] } as never,
      'u1',
    );
    const created = manager.create.mock.calls[0][1] as Record<string, unknown>;
    expect(created).toMatchObject({
      origin: CaseOrigin.NATIVE,
      branchExternalId: 'B1',
      accountKey: 'MAIN',
      caseCode: 'VV-20261119-001',
      status: CaseStatus.INTAKE,
      createdBy: 'u1',
    });
    expect(lines.replaceAll).toHaveBeenCalledTimes(1);
  });

  it('create: trùng mã trong chi nhánh → 409', async () => {
    const { svc, manager } = make(null);
    manager.save.mockRejectedValueOnce({ code: '23505' });
    await expect(
      svc.create('B1', { licensePlate: 'x', caseCode: 'A' } as never, 'u1'),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('cách ly chi nhánh: where có branchExternalId, không thấy → 404', async () => {
    const { svc, manager } = make(null);
    await expect(
      svc.update('B2', 'c1', { licensePlate: 'x' } as never),
    ).rejects.toBeInstanceOf(NotFoundException);
    const where = (
      manager.findOne.mock.calls[0][1] as { where: Record<string, unknown> }
    ).where;
    expect(where).toMatchObject({
      id: 'c1',
      branchExternalId: 'B2',
      isDeleted: false,
    });
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
