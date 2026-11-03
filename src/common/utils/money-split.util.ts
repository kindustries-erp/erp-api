/**
 * Chia đều một số tiền cho n phần theo đơn vị nhỏ nhất (mặc định đồng nguyên).
 * Phần dư (đơn vị) được cộng 1 đơn vị cho các phần đầu, nên tổng các phần luôn bằng total.
 *
 * - n <= 0 trả về mảng rỗng.
 * - decimals = 0 chia theo đồng; decimals = 2 chia theo xu.
 */
export function splitEvenly(total: number, n: number, decimals = 0): number[] {
  if (!Number.isFinite(total) || n <= 0) {
    return [];
  }
  const scale = 10 ** decimals;
  const units = Math.round(total * scale);
  const base = Math.trunc(units / n);
  const remainder = units - base * n;
  return Array.from({ length: n }, (_, i) => {
    const part = i < Math.abs(remainder) ? base + Math.sign(remainder) : base;
    return part / scale;
  });
}

export interface BalancedJournalLine {
  accountId: string;
  debit: number;
  credit: number;
  description?: string;
}

/**
 * Chia các dòng Nợ/Có đã cân thành n bộ dòng (mỗi chi nhánh một bộ), mỗi bộ vẫn cân.
 * Ghép Nợ/Có thành các cặp chuyển (cùng cách createJournalEntry), rồi chia từng cặp
 * bằng splitEvenly(…, 2): hai vế của một cặp luôn nhận cùng một phần tiền nên không lệch.
 */
export function splitBalancedLinesByBranch(
  lines: BalancedJournalLine[],
  n: number,
): BalancedJournalLine[][] {
  const buckets: BalancedJournalLine[][] = Array.from({ length: n }, () => []);
  const debits = lines.filter((l) => l.debit > 0).map((l) => ({ ...l }));
  const credits = lines.filter((l) => l.credit > 0).map((l) => ({ ...l }));

  let i = 0;
  let j = 0;
  while (i < debits.length && j < credits.length) {
    const d = debits[i];
    const c = credits[j];
    const amount = Math.round(Math.min(d.debit, c.credit) * 100) / 100;

    if (amount > 0) {
      splitEvenly(amount, n, 2).forEach((part, k) => {
        if (part <= 0) return;
        buckets[k].push({
          accountId: d.accountId,
          debit: part,
          credit: 0,
          description: d.description,
        });
        buckets[k].push({
          accountId: c.accountId,
          debit: 0,
          credit: part,
          description: c.description,
        });
      });
    }

    d.debit = Math.round((d.debit - amount) * 100) / 100;
    c.credit = Math.round((c.credit - amount) * 100) / 100;
    if (d.debit < 0.01) i++;
    if (c.credit < 0.01) j++;
  }

  return buckets;
}
