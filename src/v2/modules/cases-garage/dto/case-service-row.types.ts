import type { PaginationMeta } from '@/common/utils/paginated-result';
import type { SummaryMetric } from '@/common/utils/table-query';

/** Một hạng mục dịch vụ hoặc phụ tùng của vụ việc, kèm thông tin vụ việc. Số tiền là number. */
export interface CaseServiceRow {
  id: string;
  hdPhieuDichVuChiTietId: string | null;
  hdPhieuDichVuId: string;
  soChungTu: string | null;
  bienSoXe: string | null;
  khachHangCode: string | null;
  khachHangName: string | null;
  caseDate: string | null;
  completionDate: string | null;
  branchExternalId: string | null;
  branchName: string | null;
  status: number;
  statusName: string | null;
  classification: string | null;
  sanPhamCode: string | null;
  sanPhamName: string | null;
  noiDungChiTiet: string | null;
  loaiSanPhamCode: string | null;
  donViTinhText: string | null;
  soLuongHoaDon: number;
  donGia: number;
  tienChuaThue: number;
  thueSuat: number;
  tienCoThue: number;
  soGioCongLam: number;
  tienDichVu: number;
  tienPhuTung: number;
  giaVonPhuTung: number;
  tyLeChietKhauCt: number;
  tienChietKhauCt: number;
  khoCode: string | null;
  tienPhuPhi: number;
}

export interface CaseServicesResponse {
  items: CaseServiceRow[];
  pagination: PaginationMeta;
  summaries: Record<string, SummaryMetric | null>;
}
