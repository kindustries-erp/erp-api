import type { KgaraCase } from '../entities/kgara_case.entity';
import { pickNonEmpty, toModelYearOrNull } from '../utils/kgara-parser.util';

/** Các cột thông tin xe trên kgara_cases được ghi từ payload KGara. */
export type KgaraCaseVehicleTarget = Pick<
  KgaraCase,
  | 'soKhung'
  | 'hangXeCode'
  | 'hangXeName'
  | 'dongXeCode'
  | 'dongXeName'
  | 'namSanXuat'
>;

/** Giữ giá trị đã lưu nếu không rỗng, ngược lại lấy giá trị mới (đã trim). */
function fillIfEmpty(current: string | null, next: unknown): string | null {
  return current?.trim() ? current : pickNonEmpty(next, current);
}

/**
 * Dòng `gr/cases/list`: hãng/dòng xe. Không ghi đè giá trị đã có bằng chuỗi rỗng.
 * Số khung của list thường rỗng nên không xử lý ở đây.
 */
export function applyListVehicle(
  target: KgaraCaseVehicleTarget,
  row: Record<string, unknown>,
): void {
  target.hangXeCode = pickNonEmpty(row.MaHangSanXuat, target.hangXeCode);
  target.hangXeName = pickNonEmpty(row.TenHdHangSanXuat, target.hangXeName);
  target.dongXeCode = pickNonEmpty(row.MaDongXe, target.dongXeCode);
  target.dongXeName = pickNonEmpty(row.TenHdDongXe, target.dongXeName);
}

/**
 * Payload `gr/cases/detail`: `HoSoPhuongTien` là nguồn dự phòng cho số khung,
 * hãng/dòng xe (chỉ điền khi cột còn trống) và nguồn duy nhất của năm sản xuất.
 * Giá trị rỗng hoặc không hợp lệ giữ nguyên giá trị đã lưu; thiếu `HoSoPhuongTien` thì không đổi gì.
 */
export function applyDetailVehicle(
  target: KgaraCaseVehicleTarget,
  caseData: Record<string, any>,
): void {
  const vehicle: Record<string, unknown> = caseData.HoSoPhuongTien ?? {};
  target.soKhung = pickNonEmpty(
    caseData.SoKhung,
    pickNonEmpty(vehicle.SoKhung, target.soKhung),
  );
  // Chỉ điền khi còn trống: list là nguồn chính, tránh code và name đến từ hai nguồn khác nhau
  target.hangXeName = fillIfEmpty(target.hangXeName, vehicle.ThuongHieuName);
  target.dongXeCode = fillIfEmpty(target.dongXeCode, vehicle.HdDongXeCode);
  target.dongXeName = fillIfEmpty(target.dongXeName, vehicle.HdDongXeName);
  target.namSanXuat =
    toModelYearOrNull(vehicle.NamSanXuat) ?? target.namSanXuat ?? null;
}
