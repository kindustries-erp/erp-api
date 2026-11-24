import { BadRequestException } from '@nestjs/common';
import { CaseGarage } from '../entities/case-garage.entity';
import { CaseStatus } from '../entities/case-garage.enums';
import { CaseProgressLogGarage } from '../entities/case-progress-log-garage.entity';
import {
  assertStageWindow,
  closeOpenStage,
  switchStageLog,
  syncStageOnStatusChange,
} from './case-progress-stage.closer';

const at = (hhmm: string) => new Date(`2026-11-24T${hhmm}:00.000Z`);

function manager(opts: {
  open?: Record<string, unknown> | null;
  prev?: Record<string, unknown> | null;
  next?: Record<string, unknown> | null;
}) {
  return {
    findOne: jest.fn(
      async (
        _e: unknown,
        o: { where: Record<string, unknown>; order?: Record<string, string> },
      ) => {
        if ('startedAt' in o.where) {
          return o.order?.startedAt === 'DESC'
            ? (opts.prev ?? null)
            : (opts.next ?? null);
        }
        return opts.open ?? null;
      },
    ),
    update: jest.fn(),
    insert: jest.fn(),
  };
}

describe('case-progress-stage.closer', () => {
  it('closeOpenStage: đóng tại mốc; strict báo 400 khi trước giờ mở; không strict lấy giờ mở', async () => {
    const open = { id: 'l1', startedAt: at('08:00') };
    const m = manager({ open });
    await closeOpenStage(m as never, 'c1', at('09:00'), 'u1');
    expect(m.update).toHaveBeenLastCalledWith(
      CaseProgressLogGarage,
      { id: 'l1' },
      { endedAt: at('09:00'), updatedBy: 'u1' },
    );
    await closeOpenStage(m as never, 'c1', at('07:00'), '');
    expect(m.update).toHaveBeenLastCalledWith(
      CaseProgressLogGarage,
      { id: 'l1' },
      { endedAt: at('08:00'), updatedBy: null },
    );
    await expect(
      closeOpenStage(m as never, 'c1', at('07:00'), 'u1', true),
    ).rejects.toBeInstanceOf(BadRequestException);
    const none = manager({});
    await closeOpenStage(none as never, 'c1', at('09:00'), 'u1');
    expect(none.update).not.toHaveBeenCalled();
  });

  it('assertStageWindow: chặn chồng công đoạn trước/sau, cho phép khít mốc', async () => {
    const m = manager({
      prev: { id: 'l0', startedAt: at('06:00'), endedAt: at('07:00') },
      next: { id: 'l2', startedAt: at('09:00'), endedAt: null },
    });
    const log = { id: 'l1', caseId: 'c1', startedAt: at('07:30') };
    await expect(
      assertStageWindow(m as never, log, at('06:59'), at('08:00')),
    ).rejects.toThrow('công đoạn trước');
    await expect(
      assertStageWindow(m as never, log, at('07:30'), at('09:01')),
    ).rejects.toThrow('công đoạn sau');
    await expect(
      assertStageWindow(m as never, log, at('07:00'), at('09:00')),
    ).resolves.toBeUndefined();
  });

  it('syncStageOnStatusChange: đóng công đoạn mở, bỏ progressStage không thuộc status mới', async () => {
    const m = manager({ open: { id: 'l1', startedAt: at('08:00') } });
    await syncStageOnStatusChange(
      m as never,
      { id: 'c1', progressStage: 'PAINTING' } as never,
      CaseStatus.QUOTED,
      'u1',
      at('09:00'),
    );
    expect(m.update).toHaveBeenCalledWith(
      CaseGarage,
      { id: 'c1' },
      { progressStage: null },
    );
    const keep = manager({});
    await syncStageOnStatusChange(
      keep as never,
      { id: 'c1', progressStage: 'PAINTING' } as never,
      CaseStatus.IN_PROGRESS,
      'u1',
    );
    expect(keep.update).not.toHaveBeenCalled();
  });

  it('switchStageLog: đóng dòng mở rồi mở dòng STAGE mới; stage null chỉ đóng', async () => {
    const m = manager({ open: { id: 'l1', startedAt: at('08:00') } });
    const c = { id: 'c1', branchExternalId: 'B1', status: CaseStatus.QUOTED };
    await switchStageLog(
      m as never,
      c as never,
      'AWAITING_APPROVAL',
      'u1',
      at('09:00'),
    );
    expect(m.insert).toHaveBeenCalledWith(
      CaseProgressLogGarage,
      expect.objectContaining({
        caseId: 'c1',
        branchExternalId: 'B1',
        stage: 'AWAITING_APPROVAL',
        caseStatus: CaseStatus.QUOTED,
        startedAt: at('09:00'),
        endedAt: null,
        createdBy: 'u1',
      }),
    );
    const onlyClose = manager({ open: { id: 'l1', startedAt: at('08:00') } });
    await switchStageLog(onlyClose as never, c as never, null, 'u1');
    expect(onlyClose.update).toHaveBeenCalled();
    expect(onlyClose.insert).not.toHaveBeenCalled();
  });
});
