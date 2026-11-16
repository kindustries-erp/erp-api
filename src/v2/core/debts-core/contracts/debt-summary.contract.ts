/** Hợp đồng tổng hợp công nợ và tuổi nợ. Dùng chung cho danh sách, dashboard và export. */

/**
 * Một mốc tuổi nợ. Khoản có số ngày <= `maxDays` rơi vào mốc đầu tiên khớp;
 * mốc cuối có `maxDays = null` (không giới hạn). Số ngày âm (ngày mốc ở tương lai) rơi vào mốc đầu.
 */
export interface DebtAgingBucketDef {
  key: string;
  maxDays: number | null;
}

/** Số dư theo từng mốc tuổi nợ, khóa là `DebtAgingBucketDef.key`. */
export type DebtAgingAmounts = Record<string, number>;

/** Kết quả chia số dư vào các mốc. `undated` là số dư của khoản không có ngày mốc. */
export interface DebtAgingDistribution {
  buckets: DebtAgingAmounts;
  undated: number;
}

export interface DebtSummary {
  accountCount: number;
  original: number;
  allocated: number;
  balance: number;
  overpaid: number;
}

/** Một dòng danh sách công nợ đã gom theo đối tác (hoặc theo khóa gom do module con chọn). */
export interface DebtLedgerRow extends DebtSummary {
  partyCode: string;
  partyName: string | null;
  /** Số ngày của khoản còn nợ lâu nhất; null nếu không có khoản nào còn nợ. */
  oldestDays: number | null;
  aging: DebtAgingAmounts;
}
