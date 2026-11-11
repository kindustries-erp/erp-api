export enum AmortizationMethod {
  /** Dư nợ giảm dần - Niên kim cố định (Gốc + Lãi mỗi kỳ bằng nhau) */
  AMORTIZED = 'AMORTIZED',
  /** Gốc đều hàng tháng, lãi tính trên dư nợ giảm dần */
  EQUAL_PRINCIPAL = 'EQUAL_PRINCIPAL',
  /** Trả lãi định kỳ, gốc thanh toán toàn bộ vào cuối kỳ */
  BULLET = 'BULLET',
  /** Lãi phẳng tính trên dư nợ gốc ban đầu */
  FLAT = 'FLAT',
}

export enum LoanStatus {
  DRAFT = 'DRAFT',
  ACTIVE = 'ACTIVE',
  COMPLETED = 'COMPLETED',
  OVERDUE = 'OVERDUE',
}
