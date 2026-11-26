import { Injectable } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import { KgaraCase } from '@/kgara-api-core/entities/kgara_case.entity';
import {
  buildCaseDebtOrigins,
  CASE_DEBT_KEYS,
} from '../helpers/garage-debt-origin.builder';
import { GarageDebtOriginService } from './garage-debt-origin.service';

/**
 * Dựng nợ gốc của sổ nợ từ một vụ việc (hôm nay là nguồn duy nhất, `source_type = CASE`).
 * Chạy trong transaction của người gọi; chỉ đi qua `DebtOriginPort`, không đụng `settled_amount`.
 */
@Injectable()
export class GarageDebtLedgerProjector {
  constructor(private readonly origins: GarageDebtOriginService) {}

  /** Upsert các khoản nợ đang hiệu lực, void các khoản không còn (vụ việc xóa, loại khỏi công nợ, đổi trạng thái). */
  async projectCase(
    manager: EntityManager,
    caseId: string,
  ): Promise<{ upserted: number; voided: number }> {
    const kgaraCase = await manager
      .getRepository(KgaraCase)
      .findOne({ where: { id: caseId } });
    const built = kgaraCase
      ? buildCaseDebtOrigins(kgaraCase, await this.gpChiPhi(manager, kgaraCase))
      : [];
    const branchId = built.length
      ? await this.erpBranchOf(manager, caseId)
      : null;
    const wanted = built.map((w) => ({ ...w, branchId }));

    for (const command of wanted)
      await this.origins.upsertOrigin(manager, command);

    let voided = 0;
    for (const key of CASE_DEBT_KEYS) {
      if (
        wanted.some(
          (w) => w.direction === key.direction && w.partyType === key.partyType,
        )
      ) {
        continue;
      }
      const hit = await this.origins.voidOrigin(manager, {
        sourceType: 'CASE',
        sourceId: caseId,
        ...key,
      });
      if (hit) voided += 1;
    }
    return { upserted: wanted.length, voided };
  }

  /** Chi nhánh ERP của vụ việc: `cases_garage` dùng chung id với `kgara_cases`. */
  private async erpBranchOf(
    manager: EntityManager,
    caseId: string,
  ): Promise<string | null> {
    const rows: Array<{ branch_id: string | null }> = await manager.query(
      `SELECT branch_id FROM cases_garage WHERE id = $1 LIMIT 1`,
      [caseId],
    );
    return rows[0]?.branch_id ?? null;
  }

  /** Chi phí lãi gộp khớp theo mã vụ việc và chi nhánh (như lớp đọc; không khớp thì dùng `chi_phi` của vụ việc). */
  private async gpChiPhi(
    manager: EntityManager,
    c: KgaraCase,
  ): Promise<string | null> {
    if (!c.soChungTu) return null;
    const rows: Array<{ chi_phi: string | null }> = await manager.query(
      `SELECT chi_phi FROM kgara_gross_profit
       WHERE vu_viec_code = $1 AND branch_external_id = $2 LIMIT 1`,
      [c.soChungTu, c.branchExternalId],
    );
    return rows[0]?.chi_phi ?? null;
  }
}
