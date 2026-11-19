import type { KgaraCase } from '@/kgara-api-core/entities/kgara_case.entity';
import type { KgaraCaseService } from '@/kgara-api-core/entities/kgara_case_service.entity';
import { CaseOrigin } from '../entities/case-garage.enums';
import type { CaseGarage } from '../entities/case-garage.entity';
import type { CaseServiceGarage } from '../entities/case-service-garage.entity';
import { KGARA_CASE_FIELD_MAP } from './kgara-case.field-map';
import { KGARA_CASE_SERVICE_FIELD_MAP } from './kgara-case-service.field-map';
import { mapBackward, mapForward } from './kgara-field-map.engine';
import { kgaraCodeToStatus } from './kgara-status.map';

type Dict = Record<string, unknown>;

/** `kgara_cases` → `cases_garage` (origin KGARA_SYNC, cùng UUID). Không tự đặt `branchId`. */
export function kgaraCaseToCaseGarage(v1: KgaraCase): Partial<CaseGarage> {
  const mapped = mapForward(KGARA_CASE_FIELD_MAP, v1 as unknown as Dict);
  return {
    ...mapped,
    id: v1.id,
    legacyCaseId: v1.id,
    origin: CaseOrigin.KGARA_SYNC,
    status: kgaraCodeToStatus(v1.tinhTrangDichVu),
  } as Partial<CaseGarage>;
}

/** Chiều ngược: chỉ nhóm ERP-local của v2 → cột `kgara_cases`. */
export function caseGarageErpLocalToKgara(
  v2: Partial<CaseGarage>,
): Partial<KgaraCase> {
  return mapBackward(KGARA_CASE_FIELD_MAP, v2 as Dict) as Partial<KgaraCase>;
}

/** `kgara_case_services` → `case_services_garage`; `caseId` do projector tra từ `hdPhieuDichVuId`. */
export function kgaraServiceToCaseService(
  v1: KgaraCaseService,
  caseId: string,
  lineNumber: number,
): Partial<CaseServiceGarage> {
  const mapped = mapForward(
    KGARA_CASE_SERVICE_FIELD_MAP,
    v1 as unknown as Dict,
  );
  return {
    ...mapped,
    caseId,
    lineNumber,
    legacyServiceId: v1.id,
  } as Partial<CaseServiceGarage>;
}

/** Chiều ngược của dòng: chỉ giá vốn phụ tùng. */
export function caseServiceErpLocalToKgara(
  v2: Partial<CaseServiceGarage>,
): Partial<KgaraCaseService> {
  return mapBackward(
    KGARA_CASE_SERVICE_FIELD_MAP,
    v2 as Dict,
  ) as Partial<KgaraCaseService>;
}
