import type { KgaraCaseSettlement } from '@/kgara-api-core/entities/kgara_case_settlement.entity';
import type { DebtAllocationGarage } from '../../debts-garage/entities/debt-allocation-garage.entity';
import type { DebtGarage } from '../../debts-garage/entities/debt-garage.entity';
import { planLegacyReceipts } from '../helpers/legacy-receipt.planner';

export const LEGACY_KEY = 'legacy:';

/** Một phần phân bổ LEGACY cần có: một settlement có thể chia thành nhiều phần (KH + BH). */
export interface WantedLegacyAllocation {
  settlement: KgaraCaseSettlement;
  debt: DebtGarage;
  amount: number;
  /** Khóa idempotent đầy đủ: `legacy:<settlementId>:<debtId>:<amount>:<vòng>`. */
  key: string;
}

/** Phần khóa không gồm số vòng, dùng để so phân bổ đang có với phần cần có. */
export const legacyPrefix = (key: string) => key.slice(0, key.lastIndexOf(':'));

const toIso = (d: Date | string | null | undefined): string | null =>
  d ? new Date(d).toISOString() : null;

/** Phân bổ còn hiệu lực, không phải LEGACY (ghi ở v2 hoặc thủ công). */
const isLiveNative = (a: DebtAllocationGarage) =>
  a.origin !== 'LEGACY' && !a.reversedAt && !a.reversalOfId;

/** Settlement đã có phân bổ NATIVE tương ứng (cùng id hoặc cùng phiếu v2) thì bỏ qua. */
function coveredByNative(
  s: KgaraCaseSettlement,
  allocations: DebtAllocationGarage[],
): boolean {
  return allocations.some(
    (a) =>
      isLiveNative(a) &&
      (a.id === s.id ||
        (!!s.cashflowVoucherId && a.voucherId === s.cashflowVoucherId)),
  );
}

/**
 * Bộ phân bổ LEGACY cần có của MỘT vụ việc, tính lại từ đầu theo settlement V1 hiện có:
 * - RECEIPT: chia bằng `planLegacyReceipts` (bên trả trước, phần còn lại sang dòng phải thu khác,
 *   dư sau cùng vào dòng đầu). Sức chứa = nợ gốc trừ phân bổ NATIVE còn hiệu lực.
 * - PAYMENT: cả khoản vào dòng phải trả SUPPLIER (giữ quy tắc cũ).
 * Số vòng = số khóa LEGACY đã có của settlement, nên khóa mới không trùng khóa cũ (kể cả đã đảo).
 */
export function buildWantedLegacyAllocations(input: {
  settlements: KgaraCaseSettlement[];
  debts: DebtGarage[];
  allocations: DebtAllocationGarage[];
}): WantedLegacyAllocation[] {
  const { debts, allocations } = input;
  const settlements = input.settlements.filter(
    (s) => !coveredByNative(s, allocations),
  );
  const byId = new Map(settlements.map((s) => [s.id, s]));
  const debtById = new Map(debts.map((d) => [d.id, d]));
  const round = (sid: string) =>
    allocations.filter((a) =>
      a.idempotencyKey.startsWith(`${LEGACY_KEY}${sid}:`),
    ).length;
  const keyOf = (sid: string, debtId: string, amount: number) =>
    `${LEGACY_KEY}${sid}:${debtId}:${amount.toFixed(2)}:${round(sid)}`;

  const receivables = debts.filter((d) => d.direction === 'RECEIVABLE');
  const nativeUsed = (debtId: string) =>
    allocations
      .filter((a) => a.debtId === debtId && isLiveNative(a))
      .reduce((sum, a) => sum + Number(a.amount), 0);

  const receiptPlan = planLegacyReceipts({
    debts: receivables.map((d) => ({
      id: d.id,
      partyType: d.partyType,
      capacity: Number(d.originalAmount) - nativeUsed(d.id),
    })),
    receipts: settlements
      .filter((s) => s.settlementType === 'RECEIPT')
      .map((s) => ({
        id: s.id,
        payerType: s.payerType === 'BH' ? 'BH' : 'KH',
        amount: Number(s.amount),
        transDate: toIso(s.transDate),
        createdAt: toIso(s.createdAt),
      })),
  });

  const wanted: WantedLegacyAllocation[] = receiptPlan.map((p) => ({
    settlement: byId.get(p.settlementId) as KgaraCaseSettlement,
    debt: debtById.get(p.debtId) as DebtGarage,
    amount: p.amount,
    key: keyOf(p.settlementId, p.debtId, p.amount),
  }));

  const supplier = debts.find(
    (d) => d.direction === 'PAYABLE' && d.partyType === 'SUPPLIER',
  );
  for (const s of settlements) {
    if (s.settlementType !== 'PAYMENT' || !supplier) continue;
    const amount = Number(s.amount);
    wanted.push({
      settlement: s,
      debt: supplier,
      amount,
      key: keyOf(s.id, supplier.id, amount),
    });
  }
  return wanted;
}
