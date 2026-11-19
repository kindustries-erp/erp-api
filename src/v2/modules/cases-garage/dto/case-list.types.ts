import type { PaginationMeta } from '@/common/utils/paginated-result';
import type { SummaryMetric } from '@/common/utils/table-query';

/** Một dòng danh sách vụ việc. Không có `raw_data`; số tiền đã chuẩn hóa về number. */
export interface CaseListItem {
  id: string;
  hdPhieuDichVuId: string;
  soChungTu: string | null;
  bienSoXe: string | null;
  /** Số khung (VIN). Null khi KGara chưa trả. */
  soKhung: string | null;
  /** Hãng xe (mã và tên), dòng xe (mã và tên), năm sản xuất. Null khi KGara chưa trả. */
  hangXeCode: string | null;
  hangXeName: string | null;
  dongXeCode: string | null;
  dongXeName: string | null;
  namSanXuat: number | null;
  khachHangCode: string | null;
  khachHangName: string | null;
  /** Đối tượng thanh toán (ví dụ BH-MIC, GR-KHA-000157). Null khi không phải phiếu bảo hiểm. */
  doiTuongThanhToanCode: string | null;
  doiTuongThanhToanName: string | null;
  branchExternalId: string | null;
  tinhTrangDichVu: number | null;
  tenTinhTrangDichVu: string | null;
  classification: string | null;
  category: { id: string; code: string | null; name: string | null } | null;
  excludeFromReports: boolean;
  excludeFromDebt: boolean;
  ngayPhatSinh: string | null;
  ngayTiepNhan: string | null;
  ngayHoanThanhCongViec: string | null;
  doanhThu: number | null;
  chiPhi: number | null;
  loiNhuan: number | null;
  /** Biên lợi nhuận (%), null khi chưa có doanh thu. */
  margin: number | null;
  tienCoThue: number;
  tienDaThanhToan: number;
  tienConPhaiThanhToan: number;
  tienDaChi: number;
  phaiThuKhachHang: number;
  phaiThuBaoHiem: number;
  linkedInvoiceCount: number;
  linkedInvoiceOutCount: number;
  linkedInvoiceInCount: number;
}

export interface CaseListResponse {
  items: CaseListItem[];
  pagination: PaginationMeta;
  summaries: Record<string, SummaryMetric | null>;
}
