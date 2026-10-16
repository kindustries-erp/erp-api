import type { PeriodVoucherRow } from '../services/garage-period-report-queries.service';
import type {
  GarageDebtExportRow,
  GarageDebtGroupExportSection,
} from './garage-debts-export.helper';
import type { PnlMonthRow } from './garage-pnl-month.helper';

/** Toàn bộ dữ liệu đầu vào của file báo cáo Garage theo kỳ. */
export interface GaragePeriodReportData {
  /** Kỳ báo cáo `YYYY-MM-DD`; thiếu thì hiển thị "Tất cả". */
  from?: string;
  to?: string;
  /** Ngày xuất: số dư và tuổi nợ được tính đến ngày này. */
  asOfDate: Date;
  branchLabel?: string;
  /** P&L 12 tháng gần nhất, cũ đến mới; tháng cuối là tháng báo cáo. */
  pnlMonths: PnlMonthRow[];
  /** Phiếu thu/chi xưởng có `trans_date` trong kỳ. */
  vouchers: PeriodVoucherRow[];
  /** Công nợ của phiếu hoàn thành trong kỳ (cho các sheet chi tiết). */
  customerRows: GarageDebtExportRow[];
  supplierRows: GarageDebtExportRow[];
  customerSections?: GarageDebtGroupExportSection[];
  /** Toàn bộ nợ còn mở từ mốc ghi nhận, không giới hạn theo kỳ (cho cảnh báo quá hạn). */
  openCustomerRows: GarageDebtExportRow[];
  openSupplierRows: GarageDebtExportRow[];
}
