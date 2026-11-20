import { Injectable, Logger } from '@nestjs/common';
import { DataSource, EntityManager, FindOptionsWhere, In } from 'typeorm';
import { KgaraCase } from '@/kgara-api-core/entities/kgara_case.entity';
import { KgaraCaseService } from '@/kgara-api-core/entities/kgara_case_service.entity';
import { KgaraGrossProfit } from '@/kgara-api-core/entities/kgara_gross_profit.entity';
import type { GarageCaseProjectorPort } from '@/kgara-api-core/hub/case-projector.port';
import { BranchManagementExternalLink } from '@/v2/modules/branches-management/entities/branch-management-external-link.entity';
import { CaseGarage } from '../entities/case-garage.entity';
import { CaseOrigin } from '../entities/case-garage.enums';
import { CaseServiceGarage } from '../entities/case-service-garage.entity';
import { resolveKgaraCaseMoney } from '../helpers/kgara-case-money';
import {
  kgaraCaseToCaseGarage,
  kgaraServiceToCaseService,
} from '../helpers/kgara-case.mapper';

const KGARA_SOURCE = 'KGARA';

export type ProjectResult = 'created' | 'updated' | 'skipped';

/**
 * Chiếu vụ việc V1 (`kgara_cases` + `kgara_case_services`) sang `cases_garage` + `case_services_garage`.
 * Chỉ gọi mapper (không map tay). Cùng UUID, `origin=KGARA_SYNC`, idempotent theo `id` và
 * `legacyServiceId`; chép nguyên chi nhánh KGara và `accountKey` từ V1, không suy lại quy tắc OJ.
 */
@Injectable()
export class CaseProjectorService implements GarageCaseProjectorPort {
  private readonly logger = new Logger(CaseProjectorService.name);

  constructor(private readonly dataSource: DataSource) {}

  async projectCase(caseId: string): Promise<void> {
    await this.project(caseId);
  }

  async project(caseId: string): Promise<ProjectResult> {
    return this.dataSource.transaction(async (m) => {
      const v1 = await m.findOne(KgaraCase, { where: { id: caseId } });
      if (!v1) return 'skipped';
      if (!v1.branchExternalId) {
        this.logger.warn(`Bỏ qua ${caseId}: V1 chưa có chi nhánh KGara.`);
        return 'skipped';
      }
      const existing = await m.findOne(CaseGarage, { where: { id: caseId } });
      if (existing && existing.origin !== CaseOrigin.KGARA_SYNC)
        return 'skipped';

      const mapped = kgaraCaseToCaseGarage(v1);
      mapped.branchId = await this.resolveBranchId(m, v1);
      // Doanh thu/chi phí/lợi nhuận theo quy tắc V1: lợi nhuận gộp trước, cột vụ việc sau.
      const money = resolveKgaraCaseMoney(
        v1,
        await this.findGrossProfit(m, v1),
      );
      mapped.revenue = String(money.revenue);
      mapped.cost = String(money.cost);
      mapped.profit = String(money.profit);
      if (existing) {
        const { id: _id, createdAt: _c, updatedAt: _u, ...patch } = mapped;
        await m.update(CaseGarage, { id: caseId }, patch as never);
      } else {
        await m.insert(CaseGarage, mapped as never);
      }
      await this.projectLines(m, v1);
      return existing ? 'updated' : 'created';
    });
  }

  /** Lợi nhuận gộp V1 của vụ việc, nối theo mã hồ sơ hoặc số chứng từ (cùng điều kiện với V1). */
  private async findGrossProfit(
    m: EntityManager,
    v1: KgaraCase,
  ): Promise<KgaraGrossProfit | null> {
    const where: FindOptionsWhere<KgaraGrossProfit>[] = [];
    if (v1.hdPhieuDichVuId) where.push({ hdPhieuDichVuId: v1.hdPhieuDichVuId });
    if (v1.soChungTu) where.push({ vuViecCode: v1.soChungTu });
    if (where.length === 0) return null;
    return m.findOne(KgaraGrossProfit, { where });
  }

  /** Liên kết chi nhánh KGara → chi nhánh ERP; chưa có liên kết thì để null, không đoán. */
  private async resolveBranchId(
    m: EntityManager,
    v1: KgaraCase,
  ): Promise<string | null> {
    const links = await m.find(BranchManagementExternalLink, {
      where: {
        source: KGARA_SOURCE,
        externalId: v1.branchExternalId as string,
        accountKey: In([v1.accountKey, '']),
        isDeleted: false,
      },
    });
    const exact = links.find((l) => l.accountKey === v1.accountKey);
    return (exact ?? links[0])?.branchId ?? null;
  }

  private async projectLines(m: EntityManager, v1: KgaraCase): Promise<void> {
    const lines = await m.find(KgaraCaseService, {
      where: { hdPhieuDichVuId: v1.hdPhieuDichVuId, accountKey: v1.accountKey },
      order: { createdAt: 'ASC', id: 'ASC' },
    });
    if (!lines.length) return;
    const current = await m.find(CaseServiceGarage, {
      where: { caseId: v1.id },
    });
    const byLegacy = new Map(current.map((l) => [l.legacyServiceId, l]));
    for (const [i, line] of lines.entries()) {
      const mapped = kgaraServiceToCaseService(line, v1.id, i + 1);
      const found = byLegacy.get(line.id);
      if (found) {
        const { createdAt: _c, updatedAt: _u, ...patch } = mapped;
        await m.update(CaseServiceGarage, { id: found.id }, patch as never);
      } else {
        await m.insert(CaseServiceGarage, mapped as never);
      }
    }
  }
}
