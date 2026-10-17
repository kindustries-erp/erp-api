import type { GaragePeriodReportType } from '../dto/garage-export.dto';
import type {
  DebtTimelineRow,
  RevenueTimelineRow,
} from '../services/garage-period-timeline-queries.service';
import type { BucketUnit } from './garage-period-bucket.helper';
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
  /** Loại báo cáo quyết định sheet nào được dựng; thiếu thì `all`. */
  reportType?: GaragePeriodReportType;
  /** Đơn vị gom mốc của chart; thiếu thì suy ra từ độ dài kỳ. */
  bucketUnit?: BucketUnit;
  /** Doanh thu, giá vốn theo ngày hoàn thành phiếu trong kỳ (chart ở sheet lợi nhuận). */
  revenueTimeline?: RevenueTimelineRow[];
  /** Công nợ phát sinh và đã thu/trả theo ngày hoàn thành phiếu trong kỳ (chart ở Dashboard). */
  debtTimeline?: DebtTimelineRow[];
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
