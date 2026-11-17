import { toMoney } from '@/v2/core/debts-core';
import type {
  DebtAllocationRow,
  DebtLedgerRow,
} from '../dto/debt-ledger.types';
import type { DebtAllocationGarage } from '../entities/debt-allocation-garage.entity';
import type { DebtGarage } from '../entities/debt-garage.entity';

const iso = (d: Date | string | null | undefined): string | null =>
  d ? new Date(d).toISOString() : null;

export function toDebtLedgerRow(d: DebtGarage): DebtLedgerRow {
  return {
    id: d.id,
    branchExternalId: d.branchExternalId,
    sourceType: d.sourceType,
    sourceId: d.sourceId,
    caseId: d.caseId ?? null,
    direction: d.direction,
    partyType: d.partyType,
    partnerId: d.partnerId ?? null,
    partyCode: d.partyCode,
    partyName: d.partyName ?? null,
    licensePlate: d.licensePlate ?? null,
    originalAmount: toMoney(d.originalAmount),
    settledAmount: toMoney(d.settledAmount),
    balanceAmount: toMoney(d.balanceAmount),
    dueBaseDate: d.dueBaseDate ?? null,
    status: d.status,
    excluded: d.excluded,
    origin: d.origin,
    version: d.version,
  };
}

export function toDebtAllocationRow(
  a: DebtAllocationGarage,
): DebtAllocationRow {
  return {
    id: a.id,
    debtId: a.debtId,
    sourceType: a.sourceType,
    sourceId: a.sourceId ?? null,
    voucherId: a.voucherId ?? null,
    amount: toMoney(a.amount),
    payerType: a.payerType,
    transDate: a.transDate ?? null,
    reversedAt: iso(a.reversedAt),
    reversalOfId: a.reversalOfId ?? null,
    origin: a.origin,
    createdAt: iso(a.createdAt) as string,
  };
}
