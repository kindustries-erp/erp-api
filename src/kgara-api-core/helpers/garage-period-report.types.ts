import type {
  GaragePeriodReportSectionKey,
  GaragePeriodReportType,
} from '../dto/garage-export.dto';
import type { BucketUnit } from './garage-period-bucket.helper';
import type { LedgerVoucherRow } from './garage-ledger-classifier';
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
  /** Mục chọn trực tiếp (multi-select); có thì ưu tiên hơn `reportType`. */
  reportSections?: GaragePeriodReportSectionKey[];
  /** Đơn vị gom mốc của chart; thiếu thì suy ra từ độ dài kỳ. */
  bucketUnit?: BucketUnit;
  /** Ngày xuất: số dư và tuổi nợ được tính đến ngày này. */
  asOfDate: Date;
  branchLabel?: string;
  /** P&L 12 tháng gần nhất, cũ đến mới; tháng cuối là tháng báo cáo. */
  pnlMonths: PnlMonthRow[];
  /** Số tháng của một kỳ lợi nhuận (1 = tháng, 3 = quý, ...). */
  pnlPeriodSize?: number;
  /** Phiếu thu/chi xưởng có `trans_date` trong kỳ, đã gán nhóm dòng tiền (từ sổ quỹ Hub). */
  vouchers: LedgerVoucherRow[];
  /** Công nợ của phiếu hoàn thành trong kỳ (cho các sheet chi tiết). */
  customerRows: GarageDebtExportRow[];
  supplierRows: GarageDebtExportRow[];
  customerSections?: GarageDebtGroupExportSection[];
  /** Toàn bộ nợ còn mở từ mốc ghi nhận, không giới hạn theo kỳ (cho cảnh báo quá hạn). */
  openCustomerRows: GarageDebtExportRow[];
  openSupplierRows: GarageDebtExportRow[];
  /** Cùng dữ liệu của kỳ liền trước (cùng độ dài) để so sánh ±%; thiếu thì không có so sánh. */
  previousPeriod?: PreviousPeriodData;
}

/** Dữ liệu kỳ trước dùng cho dòng so sánh trên thẻ Dashboard. */
export interface PreviousPeriodData {
  vouchers: LedgerVoucherRow[];
  customerRows: GarageDebtExportRow[];
  supplierRows: GarageDebtExportRow[];
}
