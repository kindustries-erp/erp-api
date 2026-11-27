import { Injectable } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import { KgaraCaseSettlement } from '@/kgara-api-core/entities/kgara_case_settlement.entity';
import { CashflowVoucherGarage } from '../../cashflow-vouchers-garage/entities/cashflow-voucher-garage.entity';
import { DebtAllocationGarage } from '../../debts-garage/entities/debt-allocation-garage.entity';
import { DebtGarage } from '../../debts-garage/entities/debt-garage.entity';
import { GarageDebtLedgerProjector } from '../../debts-garage/services/garage-debt-ledger.projector';
import { GarageDebtSettlementService } from '../../debts-garage/services/garage-debt-settlement.service';
import {
  buildWantedLegacyAllocations,
  LEGACY_KEY,
  legacyPrefix,
} from './legacy-allocation-plan.helper';

/** Phân bổ LEGACY gốc còn hiệu lực (không phải dòng đảo, chưa bị đảo). */
const isLiveLegacy = (a: DebtAllocationGarage) =>
  a.origin === 'LEGACY' &&
  !a.reversalOfId &&
  !a.reversedAt &&
  a.idempotencyKey.startsWith(LEGACY_KEY);

/**
 * Đưa phân bổ `LEGACY` của một vụ việc về đúng bộ settlement V1 hiện có (không đụng phân bổ NATIVE).
 * Bộ cần có tính lại từ đầu mỗi lần (`buildWantedLegacyAllocations`): phiếu thu chia theo bên trả,
 * phần vượt dòng của bên trả sang dòng phải thu còn lại, nên tổng số dư phải thu khớp số còn thu của V1.
 */
@Injectable()
export class LegacyAllocationSyncService {
  constructor(
    private readonly ledger: GarageDebtLedgerProjector,
    private readonly settlement: GarageDebtSettlementService,
  ) {}

  /** Dựng nợ gốc rồi đưa phân bổ LEGACY của vụ việc về đúng bộ settlement V1 hiện có. */
  async syncCase(manager: EntityManager, caseId: string): Promise<void> {
    await this.ledger.projectCase(manager, caseId);
    const debts = (
      await manager.getRepository(DebtGarage).find({
        where: { caseId, isDeleted: false },
        order: { id: 'ASC' },
      })
    ).filter((d) => d.status !== 'VOID');
    const settlements = await manager
      .getRepository(KgaraCaseSettlement)
      .find({ where: { caseId } });
    const repo = manager.getRepository(DebtAllocationGarage);
    const v2Vouchers = await this.existingV2Vouchers(manager, settlements);
    const all: DebtAllocationGarage[] = [];
    for (const d of debts)
      all.push(...(await repo.find({ where: { debtId: d.id } })));

    const wanted = buildWantedLegacyAllocations({
      settlements,
      debts,
      allocations: all,
    });
    const wantedPrefixes = new Set(wanted.map((w) => legacyPrefix(w.key)));

    // Đảo phân bổ LEGACY không còn khớp (settlement mất, đổi số tiền, đổi khoản nợ, đổi cách chia).
    const kept = new Set<string>();
    for (const a of all.filter(isLiveLegacy)) {
      const prefix = legacyPrefix(a.idempotencyKey);
      if (wantedPrefixes.has(prefix) && !kept.has(prefix)) {
        kept.add(prefix);
        continue;
      }
      await this.settlement.reverse(manager, {
        allocationId: a.id,
        idempotencyKey: `legacy-reverse:${a.id}`,
      });
    }

    // Áp phần cần có chưa có phân bổ LEGACY hiệu lực. Tiền V1 đã thực thu nên luôn cho thu dư.
    for (const w of wanted) {
      if (kept.has(legacyPrefix(w.key))) continue;
      const s = w.settlement;
      const out = await this.settlement.apply(manager, {
        debtId: w.debt.id,
        sourceType: s.cashflowVoucherId ? 'CASHFLOW_VOUCHER' : 'MANUAL',
        sourceId: s.receiptNumber ?? null,
        amount: w.amount,
        idempotencyKey: w.key,
        voucherId:
          s.cashflowVoucherId && v2Vouchers.has(s.cashflowVoucherId)
            ? s.cashflowVoucherId
            : null,
        payerType: s.payerType === 'BH' ? 'BH' : 'KH',
        transDate: s.transDate ?? null,
        allowOverpay: true,
      });
      await repo.update({ id: out.allocation.id }, { origin: 'LEGACY' });
    }
  }

  /** Id phiếu v2 (`cashflow_vouchers_garage`) có thật của các settlement, để gắn `voucherId` hợp lệ. */
  private async existingV2Vouchers(
    manager: EntityManager,
    settlements: KgaraCaseSettlement[],
  ): Promise<Set<string>> {
    const found = new Set<string>();
    for (const s of settlements) {
      if (
        s.cashflowVoucherId &&
        (await manager
          .getRepository(CashflowVoucherGarage)
          .findOne({ where: { id: s.cashflowVoucherId } }))
      )
        found.add(s.cashflowVoucherId);
    }
    return found;
  }
}
