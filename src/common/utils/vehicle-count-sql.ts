/**
 * Đếm XE (theo biển số đã chuẩn hóa) thay vì đếm PHIẾU.
 *
 * Quy tắc chuẩn hóa biển: viết hoa, bỏ mọi ký tự ngoài A–Z và 0–9
 * (`30G-258.46` và `30g25846` cùng là một xe). Phiếu không có biển (NULL/rỗng)
 * là một xe riêng, khóa theo id phiếu, nên không bị gộp vào xe khác.
 */

/** Cột biển số được phép: whitelist cố định, không nhận chuỗi từ người dùng. */
export type VehiclePlateColumn = 'bien_so_xe' | 'license_plate';

const PLATE_COLUMNS: readonly VehiclePlateColumn[] = [
  'bien_so_xe',
  'license_plate',
];
const SQL_IDENTIFIER = /^[a-z_][a-z0-9_]*$/;

/**
 * Biểu thức SQL khóa xe cho một phiếu.
 * `alias` là alias bảng trong query (ví dụ `c`); phải là định danh an toàn.
 */
export function vehicleKeySql(
  alias: string,
  plateColumn: VehiclePlateColumn,
): string {
  if (!SQL_IDENTIFIER.test(alias)) {
    throw new Error(`vehicleKeySql: alias không hợp lệ: ${alias}`);
  }
  if (!PLATE_COLUMNS.includes(plateColumn)) {
    throw new Error(`vehicleKeySql: cột biển không được phép: ${plateColumn}`);
  }
  const plate = `${alias}.${plateColumn}`;
  return (
    `COALESCE(NULLIF(REGEXP_REPLACE(UPPER(${plate}), '[^A-Z0-9]', '', 'g'), ''), ` +
    `${alias}.id::text)`
  );
}

/**
 * `COUNT(DISTINCT khóa)` cho cả nhóm, hoặc chỉ các phiếu thỏa `condition`
 * khi truyền điều kiện (ví dụ một giai đoạn).
 */
export function countVehiclesSql(keySql: string, condition?: string): string {
  if (!condition) return `COUNT(DISTINCT ${keySql})`;
  return `COUNT(DISTINCT CASE WHEN ${condition} THEN ${keySql} END)`;
}

/** Bản TypeScript cùng quy tắc, dùng cho dữ liệu đã nạp trong bộ nhớ (ví dụ Excel). */
export function vehicleKey(
  plate: string | null | undefined,
  caseId: string,
): string {
  const normalized = (plate ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  return normalized.length > 0 ? normalized : caseId;
}

/** Số xe khác nhau trong danh sách phiếu (mỗi phiếu không biển là một xe). */
export function countDistinctVehicles(
  items: ReadonlyArray<{ plate: string | null | undefined; id: string }>,
): number {
  return new Set(items.map((i) => vehicleKey(i.plate, i.id))).size;
}
