import { CaseStatus } from '../entities/case-garage.enums';
import {
  computeElapsedMinutes,
  computeIsOverdue,
  toCaseProgressItem,
} from './case-progress.mapper';

const now = new Date('2026-11-22T10:00:00Z');

describe('case-progress.mapper', () => {
  it('elapsedMinutes: từ bắt đầu sửa (hoặc tiếp nhận) đến hoàn thành hoặc hiện tại', () => {
    const started = new Date('2026-11-22T08:30:00Z');
    expect(
      computeElapsedMinutes(
        { startedAt: started, receivedAt: null, completedAt: null },
        now,
      ),
    ).toBe(90);
    expect(
      computeElapsedMinutes(
        {
          startedAt: null,
          receivedAt: new Date('2026-11-22T09:00:00Z'),
          completedAt: new Date('2026-11-22T09:30:00Z'),
        },
        now,
      ),
    ).toBe(30);
    expect(
      computeElapsedMinutes(
        { startedAt: null, receivedAt: null, completedAt: null },
        now,
      ),
    ).toBeNull();
  });

  it('isOverdue: quá hạn chỉ khi chưa hoàn thành/hủy và đã qua ngày hẹn', () => {
    const past = new Date('2026-11-22T09:00:00Z');
    expect(
      computeIsOverdue(
        { status: CaseStatus.IN_PROGRESS, expectedCompletionAt: past },
        now,
      ),
    ).toBe(true);
    expect(
      computeIsOverdue(
        { status: CaseStatus.COMPLETED, expectedCompletionAt: past },
        now,
      ),
    ).toBe(false);
    expect(
      computeIsOverdue(
        { status: CaseStatus.IN_PROGRESS, expectedCompletionAt: null },
        now,
      ),
    ).toBe(false);
    expect(
      computeIsOverdue(
        {
          status: CaseStatus.IN_PROGRESS,
          expectedCompletionAt: new Date('2026-11-23T00:00:00Z'),
        },
        now,
      ),
    ).toBe(false);
  });

  it('workSummary: ưu tiên requestDescription, thiếu thì dùng tóm tắt dòng', () => {
    const base = {
      id: 'c1',
      caseCode: 'VV1',
      status: CaseStatus.IN_PROGRESS,
      overrides: {},
    } as never;
    expect(
      toCaseProgressItem(
        { ...(base as object), requestDescription: ' Thay nhớt ' } as never,
        'KTV A',
        'dòng',
        now,
      ).workSummary,
    ).toBe('Thay nhớt');
    expect(
      toCaseProgressItem(
        { ...(base as object), requestDescription: null } as never,
        null,
        'dòng',
        now,
      ).workSummary,
    ).toBe('dòng');
  });
});
