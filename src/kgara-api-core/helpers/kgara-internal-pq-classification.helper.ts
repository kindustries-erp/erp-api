import type { KgaraCase } from '../entities/kgara_case.entity';

/** Thông tin phiếu dùng để phân loại khi KGara ghi nguồn khách "Nội Bộ PQ". */
export interface KgaraClassificationContext {
  brand?: string | null;
  model?: string | null;
  plate?: string | null;
  issuedAt?: Date | null;
}

export const toClassificationContext = (
  row: Pick<
    KgaraCase,
    'hangXeName' | 'dongXeName' | 'bienSoXe' | 'ngayPhatSinh'
  >,
): KgaraClassificationContext => ({
  brand: row.hangXeName,
  model: row.dongXeName,
  plate: row.bienSoXe,
  issuedAt: row.ngayPhatSinh,
});

/** Trước ngày này không có xe OJ. `parseSafeDate` đọc ngày KGara theo giờ máy chủ. */
const OJ_START_DATE = new Date(2026, 7, 1);

/** Khớp nguyên từ, để CX-5 hay XC50 không bị nhận nhầm. */
const OJ_VEHICLE_KEYWORD = /(^|[^A-Z0-9])(OMODA|JAECOO|J5|J7|C5)([^A-Z0-9]|$)/;

const hasOjKeyword = (value?: string | null): boolean =>
  OJ_VEHICLE_KEYWORD.test((value ?? '').toUpperCase());

/**
 * "Nội Bộ PQ" gồm cả xe OJ lẫn xe sửa chữa thường, nên phải xét thêm xe.
 * Xe chưa có biển ghi tên xe vào biển số (ví dụ "J5 BEV 100032").
 * Trả `null` khi chưa đủ thông tin: chờ sync chi tiết hoặc chọn tay.
 */
export function classifyInternalPqCase({
  brand,
  model,
  plate,
  issuedAt,
}: KgaraClassificationContext): 'OJ' | 'SUA_CHUA_CHUNG' | null {
  if (issuedAt && issuedAt < OJ_START_DATE) return 'SUA_CHUA_CHUNG';
  if ([brand, model, plate].some(hasOjKeyword)) return 'OJ';
  return brand?.trim() || model?.trim() ? 'SUA_CHUA_CHUNG' : null;
}
