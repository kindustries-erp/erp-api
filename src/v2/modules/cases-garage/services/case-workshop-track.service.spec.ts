import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { CaseGarage } from '../entities/case-garage.entity';
import { CaseOrigin, CaseStatus } from '../entities/case-garage.enums';
import { CaseWorkshopTrackService } from './case-workshop-track.service';

const TRACKED = new Date('2026-11-20T08:00:00.000Z');

function caseRow(over: Partial<CaseGarage> = {}): CaseGarage {
  return {
    id: 'c1',
    caseCode: 'VV-1',
    licensePlate: '51G-12345',
    origin: CaseOrigin.KGARA_SYNC,
    status: CaseStatus.QUOTED,
    workshopTrackedAt: null,
    ...over,
  } as CaseGarage;
}

function make(opts: { current?: CaseGarage; open?: CaseGarage | null } = {}) {
  const current = opts.current ?? caseRow();
  const qb: Record<string, jest.Mock> = {};
  for (const k of ['where', 'andWhere']) qb[k] = jest.fn().mockReturnValue(qb);
  qb.getOne = jest.fn().mockResolvedValue(opts.open ?? null);
  const m = {
    update: jest.fn().mockResolvedValue(undefined),
    query: jest.fn().mockResolvedValue(undefined),
    getRepository: () => ({ createQueryBuilder: () => qb }),
  };
  const ds = { transaction: (cb: (x: unknown) => unknown) => cb(m) };
  const cases = {
    findOwned: jest.fn().mockResolvedValue(current),
    updateStatus: jest.fn(async (_b, id, status) =>
      caseRow({ ...current, id, status }),
    ),
    create: jest.fn(async () =>
      caseRow({
        id: 'n1',
        caseCode: 'VV-2611-0001',
        licensePlate: '30A-99999',
        origin: CaseOrigin.NATIVE,
        status: CaseStatus.INTAKE,
      }),
    ),
  };
  const svc = new CaseWorkshopTrackService(ds as never, cases as never);
  return { svc, m, cases, qb };
}

describe('CaseWorkshopTrackService', () => {
  const actor = { id: 'u1', canChangeStatus: true };

  it('xe có sẵn, giữ trạng thái: chỉ đánh dấu, không đổi status', async () => {
    const { svc, m, cases } = make();
    const res = await svc.track('B1', { caseId: 'c1' }, actor);
    expect(cases.findOwned).toHaveBeenCalledWith(m, 'B1', 'c1', true);
    expect(cases.updateStatus).not.toHaveBeenCalled();
    expect(m.update).toHaveBeenCalledWith(
      CaseGarage,
      { id: 'c1' },
      { workshopTrackedAt: expect.any(Date), workshopTrackedBy: 'u1' },
    );
    expect(res).toMatchObject({
      caseId: 'c1',
      status: CaseStatus.QUOTED,
      statusChanged: false,
      created: false,
    });
  });

  it('status trùng hiện tại coi như giữ nguyên, không cần quyền đổi', async () => {
    const { svc, cases } = make();
    await svc.track(
      'B1',
      { caseId: 'c1', status: CaseStatus.QUOTED },
      { id: 'u1', canChangeStatus: false },
    );
    expect(cases.updateStatus).not.toHaveBeenCalled();
  });

  it('xe có sẵn, khác trạng thái: đổi trong cùng transaction rồi đánh dấu', async () => {
    const { svc, m, cases } = make();
    const res = await svc.track(
      'B1',
      { caseId: 'c1', status: CaseStatus.IN_PROGRESS },
      actor,
    );
    expect(cases.updateStatus).toHaveBeenCalledWith(
      'B1',
      'c1',
      CaseStatus.IN_PROGRESS,
      'u1',
      m,
    );
    expect(res).toMatchObject({
      status: CaseStatus.IN_PROGRESS,
      statusChanged: true,
    });
  });

  it('đổi trạng thái khi không có garage:update → 403, không đánh dấu', async () => {
    const { svc, m, cases } = make();
    await expect(
      svc.track(
        'B1',
        { caseId: 'c1', status: CaseStatus.IN_PROGRESS },
        { id: 'u1', canChangeStatus: false },
      ),
    ).rejects.toThrow(ForbiddenException);
    expect(cases.updateStatus).not.toHaveBeenCalled();
    expect(m.update).not.toHaveBeenCalled();
  });

  it('xe đã trên bảng: giữ mốc và người đưa vào ban đầu', async () => {
    const { svc, m } = make({
      current: caseRow({ workshopTrackedAt: TRACKED }),
    });
    const res = await svc.track('B1', { caseId: 'c1' }, actor);
    expect(m.update).not.toHaveBeenCalled();
    expect(res.workshopTrackedAt).toBe(TRACKED.toISOString());
  });

  it('xe chưa có: khóa theo biển số, tạo NATIVE tiếp nhận lúc này rồi đánh dấu', async () => {
    const { svc, m, cases, qb } = make();
    const res = await svc.trackNew(
      'B1',
      { licensePlate: ' 30a-999.99 ', customerName: ' Anh Ba ' },
      { id: 'u1', canChangeStatus: false },
    );
    expect(m.query).toHaveBeenCalledWith(
      'SELECT pg_advisory_xact_lock(hashtext($1))',
      ['workshop:30A99999'],
    );
    expect(qb.andWhere).toHaveBeenCalledWith(
      expect.stringContaining('= :key'),
      {
        key: '30A99999',
      },
    );
    expect(cases.create).toHaveBeenCalledWith(
      'B1',
      expect.objectContaining({
        licensePlate: '30A-999.99',
        customerName: 'Anh Ba',
        receivedAt: expect.any(String),
      }),
      'u1',
      m,
    );
    expect(cases.updateStatus).not.toHaveBeenCalled();
    expect(res).toMatchObject({
      caseId: 'n1',
      status: CaseStatus.INTAKE,
      created: true,
      statusChanged: false,
    });
  });

  it('xe mới vào thẳng trạng thái khác INTAKE', async () => {
    const { svc, m, cases } = make();
    const res = await svc.trackNew(
      'B1',
      { licensePlate: '30A-99999', status: CaseStatus.IN_PROGRESS },
      { id: 'u1', canChangeStatus: true },
    );
    expect(cases.updateStatus).toHaveBeenCalledWith(
      'B1',
      'n1',
      CaseStatus.IN_PROGRESS,
      'u1',
      m,
    );
    expect(res.statusChanged).toBe(true);
  });

  it('biển số đã có vụ việc đang mở → 409, không tạo mới', async () => {
    const { svc, cases } = make({
      open: caseRow({ caseCode: 'KG-9' }),
    });
    await expect(
      svc.trackNew(
        'B1',
        { licensePlate: '51G12345' },
        { id: 'u1', canChangeStatus: false },
      ),
    ).rejects.toThrow(ConflictException);
    expect(cases.create).not.toHaveBeenCalled();
  });

  it('xe mới khác INTAKE mà không có garage:update → 403; biển số không có chữ/số → 400; không tạo', async () => {
    const { svc, cases, m } = make();
    await expect(
      svc.trackNew(
        'B1',
        { licensePlate: '30A-1', status: CaseStatus.CANCELLED },
        { id: 'u1', canChangeStatus: false },
      ),
    ).rejects.toThrow(ForbiddenException);
    await expect(
      svc.trackNew(
        'B1',
        { licensePlate: ' -- ' },
        { id: 'u1', canChangeStatus: true },
      ),
    ).rejects.toThrow(BadRequestException);
    expect(m.query).not.toHaveBeenCalled();
    expect(cases.create).not.toHaveBeenCalled();
  });

  it('bỏ khỏi bảng: kiểm chi nhánh rồi xóa dấu', async () => {
    const { svc, m, cases } = make();
    await svc.untrack('B1', 'c1');
    expect(cases.findOwned).toHaveBeenCalledWith(m, 'B1', 'c1', true);
    expect(m.update).toHaveBeenCalledWith(
      CaseGarage,
      { id: 'c1' },
      { workshopTrackedAt: null, workshopTrackedBy: null },
    );
  });
});
