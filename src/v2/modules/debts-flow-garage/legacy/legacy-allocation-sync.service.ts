import { Injectable } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import { KgaraCaseSettlement } from '@/kgara-api-core/entities/kgara_case_settlement.entity';
import { CashflowVoucherGarage } from '../../cashflow-vouchers-garage/entities/cashflow-voucher-garage.entity';
import { DebtAllocationGarage } from '../../debts-garage/entities/debt-allocation-garage.entity';
import { DebtGarage } from '../../debts-garage/entities/debt-garage.entity';
import { GarageDebtLedgerProjector } from '../../debts-garage/services/garage-debt-ledger.projector';
import { GarageDebtSettlementService } from '../../debts-garage/services/garage-debt-settlement.service';

const LEGACY_KEY = 'legacy:';

/** Khoản nợ nhận một settlement V1 (KH→khách, BH→bảo hiểm, chi→NCC). */
function targetOf(s: KgaraCaseSettlement) {
  if (s.settlementType === 'PAYMENT')
    return { direction: 'PAYABLE', partyType: 'SUPPLIER' };
  return {
    direction: 'RECEIVABLE',
    partyType: s.payerType === 'BH' ? 'INSURER' : 'CUSTOMER',
  };
}

/** Đưa phân bổ `LEGACY` của một vụ việc về đúng bộ settlement V1 hiện có (không đụng phân bổ NATIVE). */
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
    const v2Vouchers = new Set<string>();
    for (const s of settlements) {
      if (
        s.cashflowVoucherId &&
        (await manager
          .getRepository(CashflowVoucherGarage)
          .findOne({ where: { id: s.cashflowVoucherId } }))
      )
        v2Vouchers.add(s.cashflowVoucherId);
    }
    const all: DebtAllocationGarage[] = [];
    for (const d of debts)
      all.push(...(await repo.find({ where: { debtId: d.id } })));

    const native = (s: KgaraCaseSettlement) =>
      all.some(
        (a) =>
          a.origin !== 'LEGACY' &&
          !a.reversedAt &&
          (a.id === s.id ||
            (!!s.cashflowVoucherId && a.voucherId === s.cashflowVoucherId)),
      );
    const live = (a: DebtAllocationGarage) =>
      a.origin === 'LEGACY' &&
      !a.reversalOfId &&
      !a.reversedAt &&
      a.idempotencyKey.startsWith(LEGACY_KEY);
    const settlementIdOf = (a: DebtAllocationGarage) =>
      a.idempotencyKey.split(':')[1];

    const wanted = new Map<
      string,
      { s: KgaraCaseSettlement; debt?: DebtGarage; key: string }
    >();
    for (const s of settlements) {
      if (native(s)) continue;
      const t = targetOf(s);
      const debt = debts.find(
        (d) => d.direction === t.direction && d.partyType === t.partyType,
      );
      const rounds = all.filter((a) =>
        a.idempotencyKey.startsWith(`${LEGACY_KEY}${s.id}:`),
      ).length;
      wanted.set(s.id, {
        s,
        debt,
        key: `${LEGACY_KEY}${s.id}:${debt?.id}:${Number(s.amount).toFixed(2)}:${rounds}`,
      });
    }

    // Đảo phân bổ LEGACY không còn khớp (settlement mất, đổi số tiền, đổi khoản nợ).
    for (const a of all.filter(live)) {
      const w = wanted.get(settlementIdOf(a));
      const prefix = w ? w.key.slice(0, w.key.lastIndexOf(':')) : null;
      if (prefix && a.idempotencyKey.startsWith(`${prefix}:`)) continue;
      await this.settlement.reverse(manager, {
        allocationId: a.id,
        idempotencyKey: `legacy-reverse:${a.id}`,
      });
    }
    // Áp settlement chưa có phân bổ LEGACY hiệu lực.
    for (const { s, debt, key } of wanted.values()) {
      if (!debt) continue;
      const prefix = key.slice(0, key.lastIndexOf(':'));
      if (all.some((a) => live(a) && a.idempotencyKey.startsWith(`${prefix}:`)))
        continue;
      const out = await this.settlement.apply(manager, {
        debtId: debt.id,
        sourceType: s.cashflowVoucherId ? 'CASHFLOW_VOUCHER' : 'MANUAL',
        sourceId: s.receiptNumber ?? null,
        amount: Number(s.amount),
        idempotencyKey: key,
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
}
