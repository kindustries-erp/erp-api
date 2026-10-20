import {
  aggregateByBucket,
  buildBucketAxis,
  resolveBucketUnit,
  type BucketUnit,
} from './garage-period-bucket.helper';
import type { GaragePeriodReportData } from './garage-period-report.types';

/** Từ ghép vào tiêu đề chart: "... theo ngày/tuần/tháng". */
export const BUCKET_UNIT_LABEL: Record<BucketUnit, string> = {
  day: 'ngày',
  week: 'tuần',
  month: 'tháng',
};

export interface CashflowSeriesPoint {
  label: string;
  /** Thực thu, chi (đã chi), dự thu (phiếu thu dự kiến), dự chi (Chờ duyệt + Đã duyệt). */
  thu: number;
  chi: number;
  duThu: number;
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

/** Thu, chi, dự thu, dự chi theo ngày/tuần/tháng theo nhóm dòng tiền; mốc trống là 0. */
export function buildCashflowSeries(data: SeriesInput) {
  const unit = bucketUnitOf(data);
  const axis = buildBucketAxis(data.from, data.to, unit);
  const items = data.vouchers.map((v) => {
    const amount = Number(v.amount) || 0;
    return {
      date: v.transDate,
      thu: v.category === 'ACTUAL_IN' ? amount : 0,
      chi: v.category === 'ACTUAL_OUT' ? amount : 0,
      duThu: v.category === 'EXPECTED_IN' ? amount : 0,
      planned: v.category === 'PLANNED_OUT' ? amount : 0,
    };
  });
  const points: CashflowSeriesPoint[] = aggregateByBucket(axis, unit, items, [
    'thu',
    'chi',
    'duThu',
    'planned',
  ] as const).map(({ label, thu, chi, duThu, planned }) => ({
    label,
    thu,
    chi,
    duThu,
    planned,
  }));
  return { unit, points };
}
