import {
  aggregateByBucket,
  buildBucketAxis,
  resolveBucketUnit,
  type BucketUnit,
} from './garage-period-bucket.helper';
import type { GaragePeriodReportData } from './garage-period-report.types';
import type { PeriodVoucherRow } from '../services/garage-period-report-queries.service';

/** Từ ghép vào tiêu đề chart: "... theo ngày/tuần/tháng". */
export const BUCKET_UNIT_LABEL: Record<BucketUnit, string> = {
  day: 'ngày',
  week: 'tuần',
  month: 'tháng',
};

export interface CashflowSeriesPoint {
  label: string;
  thu: number;
  chi: number;
  /** Phiếu chi Chờ duyệt + Đã duyệt (chưa phải chi thực tế). */
  planned: number;
}

type SeriesInput = Pick<
  GaragePeriodReportData,
  'from' | 'to' | 'bucketUnit' | 'vouchers'
>;

/** Đơn vị gom của báo cáo: dùng giá trị truyền vào, thiếu thì suy ra từ độ dài kỳ. */
export const bucketUnitOf = (
  data: Pick<SeriesInput, 'from' | 'to' | 'bucketUnit'>,
) => data.bucketUnit ?? resolveBucketUnit(data.from, data.to);

/** Phiếu chi Chờ duyệt hoặc Đã duyệt: được tính vào dự chi. */
export const isPlannedPayment = (v: PeriodVoucherRow) =>
  v.type === 'PAYMENT' &&
  (v.paymentStatus === 'PENDING' || v.paymentStatus === 'APPROVED');

/** Thu, chi từ phiếu thu chi xưởng theo ngày/tuần/tháng; mốc trống là 0. */
export function buildCashflowSeries(data: SeriesInput) {
  const unit = bucketUnitOf(data);
  const axis = buildBucketAxis(data.from, data.to, unit);
  const items = data.vouchers.map((v) => ({
    date: v.transDate,
    thu: v.type === 'RECEIPT' ? Number(v.amount) || 0 : 0,
    chi: v.type === 'PAYMENT' ? Number(v.amount) || 0 : 0,
    planned: isPlannedPayment(v) ? Number(v.amount) || 0 : 0,
  }));
  const points: CashflowSeriesPoint[] = aggregateByBucket(axis, unit, items, [
    'thu',
    'chi',
    'planned',
  ] as const).map(({ label, thu, chi, planned }) => ({
    label,
    thu,
    chi,
    planned,
  }));
  return { unit, points };
}
