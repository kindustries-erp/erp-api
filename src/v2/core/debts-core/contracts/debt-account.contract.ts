/**
 * Hợp đồng khoản công nợ dùng chung (không gắn bảng, không gắn module cụ thể).
 *
 * Hiện công nợ garage được tính từ nguồn gốc (kgara_cases, kgara_case_settlements). Khi có bảng
 * công nợ riêng ở plan orchestration, bảng đó cài các hợp đồng này; API v2 phía trên không đổi.
 */

/** Phải thu (khách nợ mình) hoặc phải trả (mình nợ đối tác). */
export type DebtDirection = 'RECEIVABLE' | 'PAYABLE';

/**
 * Trạng thái suy ra từ số tiền, không lưu tay:
 * - OPEN: còn nợ, chưa phân bổ khoản nào.
 * - PARTIAL: đã phân bổ một phần.
 * - SETTLED: hết nợ (gồm khoản gốc bằng 0).
 * - OVERPAID: phân bổ vượt khoản gốc.
 */
export type DebtStatus = 'OPEN' | 'PARTIAL' | 'SETTLED' | 'OVERPAID';

/** Đối tác của khoản nợ: khách hàng, nhà cung cấp, hoặc đối tác khác. */
export interface DebtParty {
  code: string;
  name: string | null;
  /** Loại đối tác do module con đặt, ví dụ CUSTOMER, SUPPLIER. */
  type?: string | null;
}

/** Kết quả tính số dư của MỘT khoản nợ. Số tiền đã làm tròn 2 chữ số. */
export interface DebtBalance {
  /** Số tiền gốc phải thu hoặc phải trả. */
  original: number;
  /** Tổng đã phân bổ (đã thu hoặc đã chi). */
  allocated: number;
  /** Còn lại = max(0, gốc - đã phân bổ). Trả dư không bù sang khoản khác. */
  balance: number;
  /** Phần trả dư = max(0, đã phân bổ - max(0, gốc)). */
  overpaid: number;
  status: DebtStatus;
}

/** Một khoản nợ. `ownerType`/`ownerId` trỏ về chứng từ gốc (ví dụ vụ việc garage). */
export interface DebtAccount {
  id: string;
  direction: DebtDirection;
  party: DebtParty;
  ownerType: string;
  ownerId: string;
  /** Ngày làm mốc tính tuổi nợ (ví dụ ngày hoàn thành vụ việc). */
  baseDate: Date | string | null;
  balance: DebtBalance;
  /** Tăng mỗi lần thay đổi, để phát hiện ghi chồng. */
  version: number;
}
