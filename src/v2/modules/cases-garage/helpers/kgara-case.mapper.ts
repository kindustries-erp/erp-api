import type { KgaraCase } from '@/kgara-api-core/entities/kgara_case.entity';
import type { KgaraCaseService } from '@/kgara-api-core/entities/kgara_case_service.entity';
import { CaseOrigin } from '../entities/case-garage.enums';
import type { CaseGarage } from '../entities/case-garage.entity';
import type { CaseLineGarage } from '../entities/case-line-garage.entity';
import {
  KGARA_CASE_FIELD_MAP,
  KGARA_CASE_RAW_PROGRESS_MAP,
} from './kgara-case.field-map';
import { KGARA_CASE_SERVICE_FIELD_MAP } from './kgara-case-service.field-map';
import { mapForward } from './kgara-field-map.engine';
import { kgaraCodeToStatus } from './kgara-status.map';

type Dict = Record<string, unknown>;

/** `kgara_cases` → `cases_garage` (origin KGARA_SYNC, cùng UUID). Không tự đặt `branchId`. */
export function kgaraCaseToCaseGarage(v1: KgaraCase): Partial<CaseGarage> {
  const mapped = mapForward(KGARA_CASE_FIELD_MAP, v1 as unknown as Dict);
  const raw =
    v1.rawData && typeof v1.rawData === 'object' ? (v1.rawData as Dict) : {};
  return {
    ...mapped,
    ...mapForward(KGARA_CASE_RAW_PROGRESS_MAP, raw),
    id: v1.id,
    origin: CaseOrigin.KGARA_SYNC,
    status: kgaraCodeToStatus(v1.tinhTrangDichVu),
  } as Partial<CaseGarage>;
}

/** `kgara_case_services` → `case_lines_garage`; `caseId` do projector tra từ `hdPhieuDichVuId`. */
export function kgaraServiceToCaseService(
  v1: KgaraCaseService,
  caseId: string,
  lineNumber: number,
): Partial<CaseLineGarage> {
  const mapped = mapForward(
    KGARA_CASE_SERVICE_FIELD_MAP,
    v1 as unknown as Dict,
  );
  return {
    ...mapped,
    caseId,
    lineNumber,
  } as Partial<CaseLineGarage>;
}
