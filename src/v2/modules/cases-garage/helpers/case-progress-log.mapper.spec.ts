import type { CaseProgressLogGarage } from '../entities/case-progress-log-garage.entity';
import { CaseProgressLogKind } from '../entities/case-progress.enums';
import { minutesBetween, toProgressLogItem } from './case-progress-log.mapper';

const NOW = new Date('2026-11-24T10:00:00.000Z');
const log = (over: Partial<CaseProgressLogGarage> = {}) =>
  ({
    id: 'l1',
    caseId: 'c1',
    kind: CaseProgressLogKind.STAGE,
    caseStatus: 'IN_PROGRESS',
    stage: 'PAINTING',
    note: null,
    workerId: null,
    workerName: 'Thợ A',
    startedAt: new Date('2026-11-24T08:00:00.000Z'),
    endedAt: null,
    ...over,
  }) as CaseProgressLogGarage;

describe('case-progress-log.mapper', () => {
  it('minutesBetween: làm tròn xuống, không âm, null khi thiếu mốc đầu', () => {
    expect(minutesBetween(new Date('2026-11-24T09:58:59.000Z'), NOW)).toBe(1);
    expect(minutesBetween(new Date('2026-11-24T11:00:00.000Z'), NOW)).toBe(0);
    expect(minutesBetween(null, NOW)).toBeNull();
  });

  it('công đoạn mở tính tới hiện tại, đã đóng tính tới endedAt; NOTE không có thời lượng', () => {
    expect(toProgressLogItem(log(), NOW)).toMatchObject({
      durationMinutes: 120,
      endedAt: null,
      createdAt: '2026-11-24T08:00:00.000Z',
    });
    expect(
      toProgressLogItem(
        log({ endedAt: new Date('2026-11-24T08:30:00.000Z') }),
        NOW,
      ).durationMinutes,
    ).toBe(30);
    expect(
      toProgressLogItem(
        log({ kind: CaseProgressLogKind.NOTE, stage: null, note: 'x' }),
        NOW,
      ),
    ).toMatchObject({ durationMinutes: null, stage: null, note: 'x' });
  });
});
