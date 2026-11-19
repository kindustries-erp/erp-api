import { Injectable } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import { KgaraCase } from '@/kgara-api-core/entities/kgara_case.entity';
import { KgaraCaseService } from '@/kgara-api-core/entities/kgara_case_service.entity';
import {
  caseGarageErpLocalToKgara,
  caseServiceErpLocalToKgara,
} from '../helpers/kgara-case.mapper';
import type { CaseGarage } from '../entities/case-garage.entity';
import type { CaseServiceGarage } from '../entities/case-service-garage.entity';

/**
 * Mirror ngược v2 → V1 cho phần ERP-local của xe KGARA_SYNC, cùng transaction với lần ghi v2,
 * để lần projector sau không ghi đè mất chỉnh sửa. Chỉ dùng mapper (không map tay).
 */
@Injectable()
export class CaseKgaraMirrorService {
  async mirrorCase(
    manager: EntityManager,
    caseId: string,
    patch: Partial<CaseGarage>,
  ): Promise<void> {
    const v1 = caseGarageErpLocalToKgara(patch);
    if (Object.keys(v1).length === 0) return;
    await manager.update(KgaraCase, { id: caseId }, v1 as never);
  }

  async mirrorLine(
    manager: EntityManager,
    line: Pick<CaseServiceGarage, 'legacyServiceId'>,
    patch: Partial<CaseServiceGarage>,
  ): Promise<void> {
    const v1 = caseServiceErpLocalToKgara(patch);
    if (!line.legacyServiceId || Object.keys(v1).length === 0) return;
    await manager.update(
      KgaraCaseService,
      { id: line.legacyServiceId },
      v1 as never,
    );
  }
}
