import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CaseGarage } from '../entities/case-garage.entity';
import { CaseStatus } from '../entities/case-garage.enums';
import { CaseProgressLogGarage } from '../entities/case-progress-log-garage.entity';
import { CaseProgressLogKind } from '../entities/case-progress.enums';
import { CaseProgressLogCommandService } from './case-progress-log-command.service';

const E1 = '11111111-1111-4111-8111-111111111111';
const NOW = new Date('2026-11-24T10:00:00.000Z');

interface Setup {
  current?: Record<string, unknown>;
  employee?: Record<string, unknown> | null;
  openStage?: Record<string, unknown> | null;
  log?: Record<string, unknown> | null;
  /** Công đoạn kề trước/sau (truy vấn có `startedAt`). */
  prev?: Record<string, unknown> | null;
  next?: Record<string, unknown> | null;
}

const make = ({
  current = { id: 'c1', status: CaseStatus.IN_PROGRESS, branchId: 'b1' },
  employee = null,
  openStage = null,
  log = null,
  prev = null,
  next = null,
}: Setup = {}) => {
  const manager = {
    update: jest.fn(),
    create: jest.fn((_e: unknown, v: Record<string, unknown>) => v),
    save: jest.fn((v: Record<string, unknown>) => ({
      id: 'l-new',
      ...v,
    })),
    findOne: jest.fn(
      (
        entity: unknown,
        opts: {
          where: Record<string, unknown>;
          order?: Record<string, string>;
        },
      ) => {
        if (entity === CaseProgressLogGarage && 'startedAt' in opts.where) {
          return Promise.resolve(
            opts.order?.startedAt === 'DESC' ? prev : next,
          );
        }
        if (entity === CaseProgressLogGarage) {
          return Promise.resolve('kind' in opts.where ? openStage : log);
        }
        return Promise.resolve(employee);
      },
    ),
  };
  const ds = { transaction: (cb: (m: unknown) => unknown) => cb(manager) };
  const cases = { findOwned: jest.fn().mockResolvedValue(current) };
  return {
    svc: new CaseProgressLogCommandService(ds as never, cases as never),
    manager,
    cases,
  };
};

const callsFor = (manager: { update: jest.Mock }, entity: unknown) =>
  manager.update.mock.calls.filter((c) => c[0] === entity);

describe('CaseProgressLogCommandService.create', () => {
  it('STAGE: đóng công đoạn đang mở, mở dòng mới, cập nhật progressStage và người phụ trách', async () => {
    const { svc, manager, cases } = make({
      employee: { id: E1, branchId: 'b1', fullName: 'Thợ A' },
      openStage: {
        id: 'l-open',
        startedAt: new Date('2026-11-24T08:00:00.000Z'),
      },
    });
    const item = await svc.create(
      'B1',
      'c1',
      {
        kind: CaseProgressLogKind.STAGE,
        stage: 'PAINTING',
        workerId: E1,
      } as never,
      'u1',
      NOW,
    );
    expect(cases.findOwned).toHaveBeenCalledWith(manager, 'B1', 'c1', true);
    const [close] = callsFor(manager, CaseProgressLogGarage);
    expect(close[1]).toEqual({ id: 'l-open' });
    expect(close[2]).toMatchObject({ endedAt: NOW, updatedBy: 'u1' });
    expect(item).toMatchObject({
      kind: 'STAGE',
      stage: 'PAINTING',
      caseStatus: 'IN_PROGRESS',
      workerId: E1,
      workerName: 'Thợ A',
      endedAt: null,
      durationMinutes: 0,
    });
    const [casePatch] = callsFor(manager, CaseGarage);
    expect(casePatch[2]).toMatchObject({
      progressStage: 'PAINTING',
      assigneeId: E1,
      progressUpdatedBy: 'u1',
    });
  });

  it('STAGE không thuộc status cha → 400, không ghi', async () => {
    const { svc, manager } = make({
      current: { id: 'c1', status: CaseStatus.INTAKE },
    });
    await expect(
      svc.create(
        'B1',
        'c1',
        { kind: CaseProgressLogKind.STAGE, stage: 'PAINTING' } as never,
        'u1',
        NOW,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(manager.save).not.toHaveBeenCalled();
  });

  it('giờ bắt đầu sửa tay: nhận giờ quá khứ, từ chối giờ tương lai và giờ trước công đoạn đang mở', async () => {
    const past = '2026-11-24T09:00:00.000Z';
    const ok = make();
    const item = await ok.svc.create(
      'B1',
      'c1',
      {
        kind: CaseProgressLogKind.STAGE,
        stage: 'QC',
        startedAt: past,
      } as never,
      'u1',
      NOW,
    );
    expect(item.startedAt).toBe(past);
    expect(item.durationMinutes).toBe(60);

    const future = make();
    await expect(
      future.svc.create(
        'B1',
        'c1',
        {
          kind: CaseProgressLogKind.STAGE,
          stage: 'QC',
          startedAt: '2026-11-24T11:00:00.000Z',
        } as never,
        'u1',
        NOW,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    const before = make({
      openStage: { id: 'l', startedAt: new Date('2026-11-24T09:30:00.000Z') },
    });
    await expect(
      before.svc.create(
        'B1',
        'c1',
        {
          kind: CaseProgressLogKind.STAGE,
          stage: 'QC',
          startedAt: past,
        } as never,
        'u1',
        NOW,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('NOTE: bắt buộc nội dung, tên người làm nhập tay giữ nguyên, không đổi progressStage', async () => {
    const { svc, manager } = make({
      employee: { id: E1, branchId: 'b1', fullName: 'Thợ A' },
    });
    const item = await svc.create(
      'B1',
      'c1',
      {
        kind: CaseProgressLogKind.NOTE,
        note: '  Thay má phanh  ',
        workerId: E1,
        workerName: 'Anh A (phụ)',
      } as never,
      'u1',
      NOW,
    );
    expect(item).toMatchObject({
      note: 'Thay má phanh',
      workerName: 'Anh A (phụ)',
      durationMinutes: null,
    });
    const [casePatch] = callsFor(manager, CaseGarage);
    expect(casePatch[2]).not.toHaveProperty('progressStage');

    const empty = make();
    await expect(
      empty.svc.create(
        'B1',
        'c1',
        { kind: CaseProgressLogKind.NOTE, note: '  ' } as never,
        'u1',
        NOW,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('người làm không tồn tại hoặc khác chi nhánh → 400', async () => {
    const missing = make({ employee: null });
    await expect(
      missing.svc.create(
        'B1',
        'c1',
        { kind: CaseProgressLogKind.NOTE, note: 'x', workerId: E1 } as never,
        'u1',
        NOW,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    const other = make({ employee: { id: E1, branchId: 'b2' } });
    await expect(
      other.svc.create(
        'B1',
        'c1',
        { kind: CaseProgressLogKind.NOTE, note: 'x', workerId: E1 } as never,
        'u1',
        NOW,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('CaseProgressLogCommandService.update / remove', () => {
  const closed = {
    id: 'l1',
    caseId: 'c1',
    kind: CaseProgressLogKind.STAGE,
    caseStatus: 'IN_PROGRESS',
    stage: 'REPAIRING',
    startedAt: new Date('2026-11-24T07:00:00.000Z'),
    endedAt: new Date('2026-11-24T08:00:00.000Z'),
    workerId: null,
    workerName: 'Thợ B',
  };

  it('sửa tay giờ bắt đầu/kết thúc, ghi người sửa', async () => {
    const { svc, manager } = make({ log: closed });
    const item = await svc.update(
      'B1',
      'l1',
      {
        startedAt: '2026-11-24T06:30:00.000Z',
        endedAt: '2026-11-24T08:30:00.000Z',
      } as never,
      'u2',
      NOW,
    );
    expect(item.durationMinutes).toBe(120);
    const [patch] = callsFor(manager, CaseProgressLogGarage);
    expect(patch[2]).toMatchObject({ updatedBy: 'u2' });
  });

  it('giờ kết thúc trước giờ bắt đầu, hoặc sửa giờ kết thúc của công đoạn đang mở → 400', async () => {
    const a = make({ log: closed });
    await expect(
      a.svc.update(
        'B1',
        'l1',
        { endedAt: '2026-11-24T06:00:00.000Z' } as never,
        'u',
        NOW,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    const b = make({ log: { ...closed, endedAt: null } });
    await expect(
      b.svc.update(
        'B1',
        'l1',
        { endedAt: '2026-11-24T09:00:00.000Z' } as never,
        'u',
        NOW,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('endedAt null (mở lại công đoạn đã đóng) → 400, không ghi', async () => {
    const { svc, manager } = make({ log: closed });
    await expect(
      svc.update('B1', 'l1', { endedAt: null } as never, 'u', NOW),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(callsFor(manager, CaseProgressLogGarage)).toHaveLength(0);
  });

  it('sửa giờ chồng lên công đoạn trước hoặc sau → 400; không đổi giờ thì không kiểm', async () => {
    const prev = {
      ...closed,
      id: 'l0',
      startedAt: new Date('2026-11-24T05:00:00.000Z'),
      endedAt: new Date('2026-11-24T06:45:00.000Z'),
    };
    const next = {
      ...closed,
      id: 'l2',
      startedAt: new Date('2026-11-24T08:15:00.000Z'),
      endedAt: null,
    };
    const a = make({ log: closed, prev, next });
    await expect(
      a.svc.update(
        'B1',
        'l1',
        { startedAt: '2026-11-24T06:30:00.000Z' } as never,
        'u',
        NOW,
      ),
    ).rejects.toThrow('công đoạn trước');
    await expect(
      a.svc.update(
        'B1',
        'l1',
        { endedAt: '2026-11-24T08:30:00.000Z' } as never,
        'u',
        NOW,
      ),
    ).rejects.toThrow('công đoạn sau');
    await expect(
      a.svc.update(
        'B1',
        'l1',
        {
          startedAt: '2026-11-24T06:50:00.000Z',
          endedAt: '2026-11-24T08:10:00.000Z',
        } as never,
        'u',
        NOW,
      ),
    ).resolves.toMatchObject({ durationMinutes: 80 });
    const b = make({
      log: closed,
      prev: { ...prev, endedAt: new Date('2026-11-24T07:30:00.000Z') },
    });
    await expect(
      b.svc.update('B1', 'l1', { note: 'chỉ sửa mô tả' } as never, 'u', NOW),
    ).resolves.toBeDefined();
  });

  it('đổi người làm: chọn nhân viên mới lấy tên nguồn; chỉ sửa tên thì giữ id', async () => {
    const a = make({
      log: { ...closed, workerId: E1, workerName: 'Cũ' },
      employee: { id: E1, branchId: 'b1', fullName: 'Thợ A' },
    });
    const byId = await a.svc.update(
      'B1',
      'l1',
      { workerId: E1 } as never,
      'u',
      NOW,
    );
    expect(byId.workerName).toBe('Thợ A');
    const b = make({
      log: { ...closed, workerId: E1, workerName: 'Thợ A' },
      employee: { id: E1, branchId: 'b1', fullName: 'Thợ A' },
    });
    const byName = await b.svc.update(
      'B1',
      'l1',
      { workerName: 'Thợ A + phụ' } as never,
      'u',
      NOW,
    );
    expect(byName).toMatchObject({ workerId: E1, workerName: 'Thợ A + phụ' });
  });

  it('không tìm thấy nhật ký (khác chi nhánh hoặc đã xóa) → 404', async () => {
    const { svc } = make({ log: null });
    await expect(
      svc.update('B1', 'x', { note: 'a' } as never, 'u', NOW),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('xóa mềm; xóa công đoạn đang mở thì bỏ progressStage của xe', async () => {
    const a = make({ log: closed });
    await a.svc.remove('B1', 'l1', 'u');
    expect(callsFor(a.manager, CaseProgressLogGarage)[0][2]).toMatchObject({
      isDeleted: true,
    });
    expect(callsFor(a.manager, CaseGarage)).toHaveLength(0);

    const b = make({ log: { ...closed, endedAt: null } });
    await b.svc.remove('B1', 'l1', 'u');
    expect(callsFor(b.manager, CaseGarage)[0][2]).toMatchObject({
      progressStage: null,
    });
  });
});
