import type { CaseProgressItem } from '../dto/case-progress.dto';
import type { CaseProgressLogGarage } from '../entities/case-progress-log-garage.entity';
import { CaseStatus } from '../entities/case-garage.enums';
import { CaseProgressLogKind } from '../entities/case-progress.enums';
import { toProgressLogItem } from './case-progress-log.mapper';
import { toWorkshopBoardItem } from './case-workshop.mapper';

const NOW = new Date('2026-11-24T10:00:00.000Z');

const item = (over: Partial<CaseProgressItem> = {}) =>
  ({
    id: 'c1',
    receivedAt: '2026-11-24T06:00:00.000Z',
    startedAt: null,
    completedAt: null,
    workshopTrackedAt: null,
    origin: 'NATIVE',
    status: CaseStatus.IN_PROGRESS,
    ...over,
  }) as CaseProgressItem;

const log = (over: Partial<CaseProgressLogGarage>) =>
  ({
    id: 'l1',
    caseId: 'c1',
    kind: CaseProgressLogKind.STAGE,
    caseStatus: 'IN_PROGRESS',
    stage: 'REPAIRING',
    note: null,
    workerId: null,
    workerName: 'Thợ A',
    startedAt: new Date('2026-11-24T08:30:00.000Z'),
    endedAt: null,
    ...over,
  }) as CaseProgressLogGarage;

describe('toWorkshopBoardItem', () => {
  it('công đoạn đang mở: giờ bắt đầu, phút đã trôi, người làm; tổng từ lúc tiếp nhận', () => {
    const out = toWorkshopBoardItem(
      item(),
      log({}),
      log({ kind: CaseProgressLogKind.NOTE, note: 'Chờ sơn khô' }),
      NOW,
    );
    expect(out).toMatchObject({
      stageStartedAt: '2026-11-24T08:30:00.000Z',
      stageElapsedMinutes: 90,
      totalElapsedMinutes: 240,
      stageWorkerName: 'Thợ A',
      lastNote: 'Chờ sơn khô',
    });
  });

  it('chưa ghi công đoạn: null; xe đã xong tính tổng tới completedAt', () => {
    const out = toWorkshopBoardItem(
      item({
        status: CaseStatus.COMPLETED,
        completedAt: '2026-11-24T07:00:00.000Z',
      }),
      undefined,
      undefined,
      NOW,
    );
    expect(out.stageStartedAt).toBeNull();
    expect(out.stageElapsedMinutes).toBeNull();
    expect(out.totalElapsedMinutes).toBe(60);
    // Mở lại sang Đang làm: không chốt ở completedAt cũ.
    const reopened = toWorkshopBoardItem(
      item({ completedAt: '2026-11-24T07:00:00.000Z' }),
      undefined,
      undefined,
      NOW,
    );
    expect(reopened.totalElapsedMinutes).toBeGreaterThan(60);
    expect(out.lastNote).toBeNull();
  });

  it('thiếu cả tiếp nhận lẫn bắt đầu: tổng null', () => {
    const out = toWorkshopBoardItem(
      item({ receivedAt: null }),
      undefined,
      undefined,
      NOW,
    );
    expect(out.totalElapsedMinutes).toBeNull();
  });
});

describe('toProgressLogItem', () => {
  it('STAGE đã đóng tính tới endedAt, đang mở tính tới now; NOTE không có thời lượng', () => {
    expect(
      toProgressLogItem(
        log({ endedAt: new Date('2026-11-24T09:00:00.000Z') }),
        NOW,
      ).durationMinutes,
    ).toBe(30);
    expect(toProgressLogItem(log({}), NOW).durationMinutes).toBe(90);
    expect(
      toProgressLogItem(log({ kind: CaseProgressLogKind.NOTE }), NOW)
        .durationMinutes,
    ).toBeNull();
  });
});
