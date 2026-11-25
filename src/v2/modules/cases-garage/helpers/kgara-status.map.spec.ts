import { CaseOrigin, CaseStatus } from '../entities/case-garage.enums';
import {
  canTransition,
  kgaraCodeToStatus,
  statusToKgaraCode,
} from './kgara-status.map';

describe('kgara-status.map', () => {
  it('map 5 mã KGara và round-trip', () => {
    for (const code of [0, 1, 2, 3, 9]) {
      expect(statusToKgaraCode(kgaraCodeToStatus(code))).toBe(code);
    }
  });
  it('mã lạ/null rơi về INTAKE', () => {
    expect(kgaraCodeToStatus(null)).toBe(CaseStatus.INTAKE);
    expect(kgaraCodeToStatus(42)).toBe(CaseStatus.INTAKE);
  });
  it('bảng chuyển trạng thái', () => {
    expect(canTransition(CaseStatus.INTAKE, CaseStatus.QUOTED)).toBe(true);
    expect(canTransition(CaseStatus.INTAKE, CaseStatus.COMPLETED)).toBe(false);
    expect(canTransition(CaseStatus.COMPLETED, CaseStatus.IN_PROGRESS)).toBe(
      true,
    );
  });
  it('xe NATIVE chặn bước lùi QUOTED → INTAKE', () => {
    expect(
      canTransition(CaseStatus.QUOTED, CaseStatus.INTAKE, CaseOrigin.NATIVE),
    ).toBe(false);
  });
  it('xe KGARA_SYNC đổi tự do, trừ đổi sang chính nó', () => {
    const sync = CaseOrigin.KGARA_SYNC;
    expect(canTransition(CaseStatus.QUOTED, CaseStatus.INTAKE, sync)).toBe(
      true,
    );
    expect(canTransition(CaseStatus.COMPLETED, CaseStatus.QUOTED, sync)).toBe(
      true,
    );
    expect(canTransition(CaseStatus.QUOTED, CaseStatus.QUOTED, sync)).toBe(
      false,
    );
  });
});
