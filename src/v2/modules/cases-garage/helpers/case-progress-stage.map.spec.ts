import { CaseStatus } from '../entities/case-garage.enums';
import { CaseProgressStage } from '../entities/case-progress.enums';
import {
  STAGES_BY_STATUS,
  isStageOf,
  stagesOf,
  statusOfStage,
} from './case-progress-stage.map';

describe('case-progress-stage.map', () => {
  it('mỗi status v2 có danh sách status nhỏ, IN_PROGRESS giữ 5 công đoạn cũ', () => {
    for (const status of Object.values(CaseStatus)) {
      expect(stagesOf(status).length).toBeGreaterThan(0);
    }
    expect(stagesOf(CaseStatus.IN_PROGRESS)).toEqual([
      'WAITING_PARTS',
      'REPAIRING',
      'PAINTING',
      'QC',
      'READY_FOR_DELIVERY',
    ]);
  });

  it('mọi giá trị enum thuộc đúng một status', () => {
    const all = Object.values(STAGES_BY_STATUS).flat();
    expect(new Set(all).size).toBe(all.length);
    expect([...all].sort()).toEqual(Object.values(CaseProgressStage).sort());
  });

  it('isStageOf chấp nhận null và từ chối stage của status khác', () => {
    expect(isStageOf(CaseStatus.INTAKE, null)).toBe(true);
    expect(isStageOf(CaseStatus.INTAKE, 'INSPECTED')).toBe(true);
    expect(isStageOf(CaseStatus.INTAKE, 'REPAIRING')).toBe(false);
    expect(isStageOf(CaseStatus.COMPLETED, 'UNKNOWN')).toBe(false);
  });

  it('statusOfStage trả status cha hoặc null', () => {
    expect(statusOfStage('DELIVERED')).toBe(CaseStatus.COMPLETED);
    expect(statusOfStage('AWAITING_APPROVAL')).toBe(CaseStatus.QUOTED);
    expect(statusOfStage('NOPE')).toBeNull();
  });
});
