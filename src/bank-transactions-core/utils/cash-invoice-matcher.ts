import type { CashReceipt } from './cash-sheet-reader';

/** Hóa đơn bán ra còn số dư, đã tính trừ cấn trừ và điều chỉnh. */
export interface OpenInvoice {
  id: string;
  invoiceNo: string;
  /** YYYY-MM-DD */
  invoiceDate: string;
  plate: string;
  /** Số dư còn lại (VND). */
  remaining: number;
}

export type MatchGrade = 'EXACT' | 'NEAR' | 'WIDE';

export interface CashInvoiceMatch {
  receipt: CashReceipt;
  invoice: OpenInvoice;
  /** Số tiền cấn trừ = min(tiền thu, còn lại), VND. */
  allocated: number;
  /** tiền thu − còn lại, VND (âm nếu thu kém hóa đơn). */
  diff: number;
  grade: MatchGrade;
}

export type UnmatchedReason = 'NO_CANDIDATE' | 'CONFLICT' | 'AMBIGUOUS';

export interface CashInvoiceUnmatched {
  receipt: CashReceipt;
  reason: UnmatchedReason;
}

export interface CashInvoiceMatchResult {
  matches: CashInvoiceMatch[];
  unmatched: CashInvoiceUnmatched[];
}

/** Ngưỡng phân hạng theo VND: < 1đ EXACT, < 1.000đ NEAR, còn lại WIDE. */
const NEAR_LIMIT_VND = 1000;

const toCents = (vnd: number): number => Math.round(vnd * 100);

const gradeOf = (diffCents: number): MatchGrade => {
  const abs = Math.abs(diffCents);
  if (abs < 100) return 'EXACT';
  if (abs < NEAR_LIMIT_VND * 100) return 'NEAR';
  return 'WIDE';
};

/**
 * Ghép từng khoản thu tiền mặt với đúng một hóa đơn cùng biển số.
 *
 * Quy tắc:
 * - Hóa đơn phải xuất vào ngày thu hoặc sau ngày thu.
 * - |còn lại − tiền thu| < tolerance (VND, mặc định 10.000đ).
 * - Mỗi hóa đơn chỉ được ghép một lần; xử lý khoản thu theo ngày rồi theo số dòng.
 * - Hai hóa đơn cùng độ lệch nhỏ nhất → AMBIGUOUS, không tự ghép.
 * - Tính toàn bộ theo cent để tránh sai số số thực.
 */
export function matchReceiptsToInvoices(
  receipts: CashReceipt[],
  invoices: OpenInvoice[],
  toleranceVnd = 10000,
): CashInvoiceMatchResult {
  const toleranceCents = toCents(toleranceVnd);
  const usedInvoiceIds = new Set<string>();
  const byPlate = new Map<string, OpenInvoice[]>();
  for (const inv of invoices) {
    const list = byPlate.get(inv.plate) ?? [];
    list.push(inv);
    byPlate.set(inv.plate, list);
  }

  const ordered = [...receipts].sort(
    (a, b) => a.date.localeCompare(b.date) || a.row - b.row,
  );
  const result: CashInvoiceMatchResult = { matches: [], unmatched: [] };

  for (const receipt of ordered) {
    const pool = (byPlate.get(receipt.plate) ?? []).filter(
      (inv) => inv.invoiceDate >= receipt.date && toCents(inv.remaining) > 0,
    );
    if (pool.length === 0) {
      result.unmatched.push({ receipt, reason: 'NO_CANDIDATE' });
      continue;
    }

    const receiptCents = toCents(receipt.amount);
    const near = pool
      .map((inv) => ({
        inv,
        diffCents: receiptCents - toCents(inv.remaining),
      }))
      .filter((c) => Math.abs(c.diffCents) < toleranceCents);
    if (near.length === 0) {
      result.unmatched.push({ receipt, reason: 'NO_CANDIDATE' });
      continue;
    }

    const free = near.filter((c) => !usedInvoiceIds.has(c.inv.id));
    if (free.length === 0) {
      result.unmatched.push({ receipt, reason: 'CONFLICT' });
      continue;
    }

    const bestAbs = Math.min(...free.map((c) => Math.abs(c.diffCents)));
    const best = free.filter((c) => Math.abs(c.diffCents) === bestAbs);
    if (best.length > 1) {
      result.unmatched.push({ receipt, reason: 'AMBIGUOUS' });
      continue;
    }

    const chosen = best[0];
    usedInvoiceIds.add(chosen.inv.id);
    const allocatedCents = Math.min(
      receiptCents,
      toCents(chosen.inv.remaining),
    );
    result.matches.push({
      receipt,
      invoice: chosen.inv,
      allocated: allocatedCents / 100,
      diff: chosen.diffCents / 100,
      grade: gradeOf(chosen.diffCents),
    });
  }

  return result;
}
