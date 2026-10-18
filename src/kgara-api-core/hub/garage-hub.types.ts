import { KgaraCashflowVoucher } from '../entities/kgara_cashflow_voucher.entity';
import type {
  LedgerTotals,
  LedgerVoucherRow,
} from '../helpers/garage-ledger-classifier';

/** Payload khi phiếu dịch vụ thay đổi trạng thái */
export interface CaseTransitionEvent {
  caseId: string;
  previousStatus?: number | null;
  newStatus?: number | null;
  ngayHoanThanhCongViec?: Date | string | null;
  tienConPhaiThanhToan?: number | null;
  tienCoThue?: number | null;
  khachHangName?: string | null;
  licensePlate?: string | null;
  soChungTu?: string | null;
}

/** Kết quả xử lý sự kiện chuyển trạng thái case */
export interface CaseTransitionResult {
  caseId: string;
  handled: boolean;
  actionTaken:
    | 'CREATED_EXPECTED'
    | 'UPDATED_EXPECTED'
    | 'CANCELLED_EXPECTED'
    | 'NO_OP';
  voucherId?: string;
}

/** Payload khi phiếu chi xưởng đổi trạng thái sang PAID */
export interface CashflowSettledEvent {
  voucher: KgaraCashflowVoucher;
  user?: { sub?: string; email?: string };
}

/** Kết quả xử lý phiếu chi */
export interface CashflowSettledResult {
  voucherId: string;
  syncedToOpex: boolean;
  opexId?: string;
  isCommissionProtected: boolean;
}

/** Payload hoa hồng tự động từ P&L tháng */
export interface PnlCommissionEvent {
  year: number;
  month: number;
  saleCommission: number;
  dvCommission: number;
  kyGuiProfitRate: number;
}

/** Kết quả đồng bộ hoa hồng P&L vào sổ sách */
export interface PnlCommissionSyncResult {
  year: number;
  month: number;
  saleCommission: number;
  dvCommission: number;
  syncedOpex: number;
  syncedVouchers: number;
  createdVouchers: number;
  updatedVouchers: number;
  deltaVouchers: number;
}

/** Báo cáo tổng thể sức khỏe và đối soát dữ liệu Garage */
export interface GarageHealthOverview {
  asOf: string;
  expectedReceipts: {
    totalActiveCount: number;
    totalActiveAmount: number;
    overdueCount: number;
    overdueAmount: number;
  };
  commissionCheck: {
    year: number;
    month: number;
    opexCommissionTotal: number;
    cashflowCommissionTotal: number;
    isBalanced: boolean;
    difference: number;
  };
}

/** Sổ quỹ trong kỳ: phiếu đã phân loại và tổng theo nhóm. */
export interface PeriodLedger {
  vouchers: LedgerVoucherRow[];
  totals: LedgerTotals;
}
