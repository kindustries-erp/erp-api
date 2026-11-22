import type {
  DebtBalance,
  DebtStatus,
} from '../contracts/debt-account.contract';
import type { DebtSummary } from '../contracts/debt-summary.contract';

/** Số tiền từ DB (numeric trả về chuỗi), từ DTO hoặc rỗng. */
export type MoneyInput = number | string | null | undefined;

const CENTS = 100;

function toCents(value: MoneyInput): number {
  const n = typeof value === 'string' ? Number(value) : (value ?? 0);
  return Number.isFinite(n) ? Math.round(n * CENTS) : 0;
}

/** Làm tròn 2 chữ số, chuỗi và rỗng được chuẩn hóa về số. */
export function toMoney(value: MoneyInput): number {
  return toCents(value) / CENTS;
}

/**
 * Engine thuần tính số dư công nợ, dùng cho cả phải thu và phải trả.
 * Mọi phép tính qua đơn vị 1/100 để cộng nhiều khoản không bị lệch dấu phẩy động.
 *
 * Quy tắc: số dư MỘT khoản = max(0, gốc - đã phân bổ). Trả dư của khoản này không bù sang khoản khác
 * (khớp `_recalculateCaseDebt` của phải thu và `GREATEST(chi phí - đã chi, 0)` của phải trả hiện tại).
 */
export class DebtBalanceEngine {
  /** Cộng các khoản phân bổ (đã loại phân bổ bị đảo trước khi gọi). */
  static sumAllocations(amounts: ReadonlyArray<MoneyInput>): number {
    return (
      amounts.reduce<number>((sum, amount) => sum + toCents(amount), 0) / CENTS
    );
  }

  static compute(original: MoneyInput, allocated: MoneyInput): DebtBalance {
    const originalCents = toCents(original);
    const allocatedCents = toCents(allocated);
    const payableCents = Math.max(0, originalCents);
    const balanceCents = Math.max(0, payableCents - allocatedCents);
    const overpaidCents = Math.max(0, allocatedCents - payableCents);

    return {
      original: originalCents / CENTS,
      allocated: allocatedCents / CENTS,
      balance: balanceCents / CENTS,
      overpaid: overpaidCents / CENTS,
      status: DebtBalanceEngine.statusOf(
        balanceCents,
        allocatedCents,
        overpaidCents,
      ),
    };
  }

  /** Gộp nhiều khoản đã tính. Không bù trừ: tổng số dư là tổng các số dư đã clamp. */
  static summarize(balances: ReadonlyArray<DebtBalance>): DebtSummary {
    const sum = (pick: (b: DebtBalance) => number): number =>
      balances.reduce((acc, b) => acc + toCents(pick(b)), 0) / CENTS;

    return {
      accountCount: balances.length,
      original: sum((b) => b.original),
      allocated: sum((b) => b.allocated),
      balance: sum((b) => b.balance),
      overpaid: sum((b) => b.overpaid),
    };
  }

  private static statusOf(
    balanceCents: number,
    allocatedCents: number,
    overpaidCents: number,
  ): DebtStatus {
    if (overpaidCents > 0) return 'OVERPAID';
    if (balanceCents === 0) return 'SETTLED';
    return allocatedCents === 0 ? 'OPEN' : 'PARTIAL';
  }
}
