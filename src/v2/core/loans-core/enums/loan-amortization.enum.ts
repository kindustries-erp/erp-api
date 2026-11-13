export enum AmortizationMethod {
  /** Dư nợ giảm dần - Niên kim cố định (Gốc + Lãi mỗi kỳ bằng nhau) */
  AMORTIZED = 'AMORTIZED',
  /** Gốc đều hàng tháng, lãi tính trên dư nợ giảm dần */
  EQUAL_PRINCIPAL = 'EQUAL_PRINCIPAL',
  /** Trả lãi định kỳ, gốc thanh toán toàn bộ vào cuối kỳ */
  BULLET = 'BULLET',
  /** Lãi phẳng tính trên dư nợ gốc ban đầu */
  FLAT = 'FLAT',
  /** Ân hạn nợ gốc: Chỉ trả lãi giai đoạn đầu, gốc trả sau */
  GRACE_PERIOD = 'GRACE_PERIOD',
  /** Thanh toán toàn bộ 1 lần khi đáo hạn: Cả gốc và lãi trả cuối kỳ */
  MATURITY_LUMP_SUM = 'MATURITY_LUMP_SUM',
}

export enum LoanStatus {
  DRAFT = 'DRAFT',
  ACTIVE = 'ACTIVE',
  COMPLETED = 'COMPLETED',
  OVERDUE = 'OVERDUE',
}
