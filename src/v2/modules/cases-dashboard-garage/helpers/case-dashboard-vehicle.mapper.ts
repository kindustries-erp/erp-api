import type {
  CaseDashboardCaseItemDto,
  CaseDashboardVehicleItemDto,
} from '../dto/case-dashboard.types';

/**
 * Gom các lệnh cùng một xe thành một dòng drill-down. Hàm thuần.
 * `cases` phải được sắp mới nhất trước (đúng thứ tự truy vấn); biển số và khách hàng lấy từ lệnh
 * mới nhất có giá trị, `latestAt` là mốc lớn nhất của (hoàn thành, nếu không có thì tiếp nhận).
 */
export function toVehicleItemDto(
  key: string,
  cases: CaseDashboardCaseItemDto[],
): CaseDashboardVehicleItemDto {
  const marks = cases
    .map((c) => c.completedAt ?? c.receivedAt)
    .filter((m): m is string => Boolean(m));
  return {
    vehicleKey: key,
    licensePlate: cases.find((c) => c.licensePlate)?.licensePlate ?? null,
    customerName: cases.find((c) => c.customerName)?.customerName ?? null,
    caseCount: cases.length,
    caseCodes: cases.map((c) => c.caseCode),
    amount: cases.reduce((sum, c) => sum + c.amount, 0),
    latestAt: marks.length ? marks.reduce((a, b) => (a > b ? a : b)) : null,
    cases,
  };
}

/** Nhóm các lệnh đã map theo khóa xe, giữ nguyên thứ tự lệnh trong từng nhóm. */
export function groupCasesByVehicle(
  cases: CaseDashboardCaseItemDto[],
): Map<string, CaseDashboardCaseItemDto[]> {
  const grouped = new Map<string, CaseDashboardCaseItemDto[]>();
  for (const item of cases) {
    const bucket = grouped.get(item.vehicleKey);
    if (bucket) bucket.push(item);
    else grouped.set(item.vehicleKey, [item]);
  }
  return grouped;
}
