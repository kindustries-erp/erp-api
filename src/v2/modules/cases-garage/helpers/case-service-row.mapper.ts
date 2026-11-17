import { toMoney } from '@/v2/core/debts-core';
import type { CaseServiceRow } from '../dto/case-service-row.types';

type Raw = Record<string, unknown>;
const text = (v: unknown) => (typeof v === 'string' ? v : null);
const num = (v: unknown) => toMoney((v ?? 0) as string | number);

/** Cột SELECT của một dòng hạng mục (bí danh `srv` = dịch vụ, `c` = vụ việc, `b` = chi nhánh). */
export const CASE_SERVICE_SELECT: string[] = [
  'srv.id AS "id"',
  'srv.hd_phieu_dich_vu_chi_tiet_id AS "hdPhieuDichVuChiTietId"',
  'srv.hd_phieu_dich_vu_id AS "hdPhieuDichVuId"',
  'srv.noi_dung_chi_tiet AS "noiDungChiTiet"',
  'srv.san_pham_code AS "sanPhamCode"',
  'srv.san_pham_name AS "sanPhamName"',
  'srv.loai_san_pham_code AS "loaiSanPhamCode"',
  'srv.don_vi_tinh_text AS "donViTinhText"',
  'srv.so_luong_hoa_don AS "soLuongHoaDon"',
  'srv.don_gia AS "donGia"',
  'srv.tien_chua_thue AS "tienChuaThue"',
  'srv.thue_suat AS "thueSuat"',
  'srv.tien_co_thue AS "tienCoThue"',
  'srv.so_gio_cong_lam AS "soGioCongLam"',
  'srv.tien_dich_vu AS "tienDichVu"',
  'srv.tien_phu_tung AS "tienPhuTung"',
  'srv.gia_von_phu_tung AS "giaVonPhuTung"',
  'srv.ty_le_chiet_khau_ct AS "tyLeChietKhauCt"',
  'srv.tien_chiet_khau_ct AS "tienChietKhauCt"',
  'srv.kho_code AS "khoCode"',
  'srv.tien_phu_phi AS "tienPhuPhi"',
  'c.so_chung_tu AS "soChungTu"',
  'c.bien_so_xe AS "bienSoXe"',
  'c.khach_hang_code AS "khachHangCode"',
  'c.khach_hang_name AS "khachHangName"',
  'c.tinh_trang_dich_vu AS "status"',
  'c.ten_tinh_trang_dich_vu AS "statusName"',
  'c.classification AS "classification"',
  'c.branch_external_id AS "branchExternalId"',
  'COALESCE(b.name, b.code, c.branch_external_id) AS "branchName"',
  `TO_CHAR(COALESCE(c.ngay_tiep_nhan, c.ngay_phat_sinh), 'YYYY-MM-DD') AS "caseDate"`,
  `TO_CHAR(c.ngay_hoan_thanh_cong_viec, 'YYYY-MM-DD') AS "completionDate"`,
];

export function toCaseServiceRow(r: Raw): CaseServiceRow {
  return {
    id: String(text(r.id) ?? ''),
    hdPhieuDichVuChiTietId: text(r.hdPhieuDichVuChiTietId),
    hdPhieuDichVuId: text(r.hdPhieuDichVuId) ?? '',
    soChungTu: text(r.soChungTu),
    bienSoXe: text(r.bienSoXe),
    khachHangCode: text(r.khachHangCode),
    khachHangName: text(r.khachHangName),
    caseDate: text(r.caseDate),
    completionDate: text(r.completionDate),
    branchExternalId: text(r.branchExternalId),
    branchName: text(r.branchName),
    status: Number(r.status ?? 0) || 0,
    statusName: text(r.statusName),
    classification: text(r.classification),
    sanPhamCode: text(r.sanPhamCode),
    sanPhamName: text(r.sanPhamName),
    noiDungChiTiet: text(r.noiDungChiTiet),
    loaiSanPhamCode: text(r.loaiSanPhamCode),
    donViTinhText: text(r.donViTinhText),
    soLuongHoaDon: num(r.soLuongHoaDon),
    donGia: num(r.donGia),
    tienChuaThue: num(r.tienChuaThue),
    thueSuat: num(r.thueSuat),
    tienCoThue: num(r.tienCoThue),
    soGioCongLam: num(r.soGioCongLam),
    tienDichVu: num(r.tienDichVu),
    tienPhuTung: num(r.tienPhuTung),
    giaVonPhuTung: num(r.giaVonPhuTung),
    tyLeChietKhauCt: num(r.tyLeChietKhauCt),
    tienChietKhauCt: num(r.tienChietKhauCt),
    khoCode: text(r.khoCode),
    tienPhuPhi: num(r.tienPhuPhi),
  };
}
