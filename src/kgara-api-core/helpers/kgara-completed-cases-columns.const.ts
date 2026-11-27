import type { ExcelReportColumnDef } from './kgara-excel-layout.helper';

/**
 * Định nghĩa cột chuẩn cho Sheet 1: Bảng kê phiếu kết thúc
 */
export const COMPLETED_CASES_COLUMNS: ExcelReportColumnDef[] = [
  { header: 'STT', key: 'index', width: 8, align: 'center' },
  { header: 'Số phiếu', key: 'soChungTu', width: 18, align: 'left' },
  { header: 'Biển số xe', key: 'bienSoXe', width: 14, align: 'center' },
  { header: 'Mã KH', key: 'khachHangCode', width: 16, align: 'left' },
  { header: 'Tên khách hàng', key: 'khachHangName', width: 32, align: 'left' },
  { header: 'Tên trên phiếu', key: 'tenKhachHang', width: 28, align: 'left' },
  {
    header: 'Trạng thái',
    key: 'tenTinhTrangDichVu',
    width: 18,
    align: 'center',
  },
  { header: 'Phân loại', key: 'classification', width: 18, align: 'center' },
  {
    header: 'Ngày tiếp nhận',
    key: 'ngayTiepNhan',
    width: 16,
    align: 'center',
    style: { numFmt: 'dd/mm/yyyy' },
  },
  {
    header: 'Ngày hoàn thành',
    key: 'ngayHoanThanhCongViec',
    width: 18,
    align: 'center',
    style: { numFmt: 'dd/mm/yyyy' },
  },
  {
    header: 'Phải thu BH (VNĐ)',
    key: 'phaiThuBaoHiem',
    width: 20,
    isSum: true,
    align: 'right',
    style: { numFmt: '#,##0.00' },
  },
  {
    header: 'Phải thu KH (VNĐ)',
    key: 'phaiThuKhachHang',
    width: 20,
    isSum: true,
    align: 'right',
    style: { numFmt: '#,##0.00' },
  },
  {
    header: 'Phải thu (VNĐ)',
    key: 'phaiThu',
    width: 22,
    isSum: true,
    align: 'right',
    style: { numFmt: '#,##0.00' },
  },
  {
    header: 'Đã thu (VNĐ)',
    key: 'daThu',
    width: 20,
    isSum: true,
    align: 'right',
    style: { numFmt: '#,##0.00' },
  },
  {
    header: 'Còn lại phải thu (VNĐ)',
    key: 'conPhaiThu',
    width: 22,
    isSum: true,
    align: 'right',
    style: { numFmt: '#,##0.00' },
  },
  {
    header: 'Ghi chú thu',
    key: 'ghiChuThu',
    width: 26,
    align: 'left',
  },
  {
    header: 'Chi phí nhân công (VNĐ)',
    key: 'chiPhiNhanCong',
    width: 22,
    isSum: true,
    align: 'right',
    style: { numFmt: '#,##0.00' },
  },
  {
    header: 'Chi phí phụ tùng (VNĐ)',
    key: 'chiPhiPhuTung',
    width: 22,
    isSum: true,
    align: 'right',
    style: { numFmt: '#,##0.00' },
  },
  {
    header: 'Phải trả (VNĐ)',
    key: 'phaiTra',
    width: 22,
    isSum: true,
    align: 'right',
    style: { numFmt: '#,##0.00' },
  },
  {
    header: 'Đã trả (VNĐ)',
    key: 'daTra',
    width: 20,
    isSum: true,
    align: 'right',
    style: { numFmt: '#,##0.00' },
  },
  {
    header: 'Còn lại phải trả (VNĐ)',
    key: 'conPhaiTra',
    width: 22,
    isSum: true,
    align: 'right',
    style: { numFmt: '#,##0.00' },
  },
  {
    header: 'Ghi chú trả',
    key: 'ghiChuTra',
    width: 26,
    align: 'left',
  },
  {
    header: 'Thuế GTGT (VNĐ)',
    key: 'vatAmount',
    width: 20,
    isSum: true,
    align: 'right',
    style: { numFmt: '#,##0.00' },
  },
  {
    header: 'Doanh thu (VNĐ)',
    key: 'doanhThu',
    width: 20,
    isSum: true,
    align: 'right',
    style: { numFmt: '#,##0.00' },
  },
  {
    header: 'Chi phí / Giá vốn (VNĐ)',
    key: 'chiPhi',
    width: 22,
    isSum: true,
    align: 'right',
    style: { numFmt: '#,##0.00' },
  },
  {
    header: 'Lợi nhuận gộp (VNĐ)',
    key: 'loiNhuan',
    width: 22,
    isSum: true,
    align: 'right',
    style: { numFmt: '#,##0.00' },
  },
  {
    header: 'Biên LN (%)',
    key: 'margin',
    width: 14,
    align: 'right',
    style: { numFmt: '0.0%' },
  },
  {
    header: 'Hóa đơn VAT liên kết',
    key: 'linkedInvoices',
    width: 25,
    align: 'center',
  },
  { header: 'Chi nhánh', key: 'branchName', width: 22, align: 'left' },
  // Thêm cuối sheet để không làm lệch chữ cột của các công thức phía trên
  {
    header: 'Dự thu (VNĐ)',
    key: 'duThu',
    width: 20,
    isSum: true,
    align: 'right',
    style: { numFmt: '#,##0.00' },
  },
  {
    header: 'Dự chi (VNĐ)',
    key: 'duChi',
    width: 20,
    isSum: true,
    align: 'right',
    style: { numFmt: '#,##0.00' },
  },
];

/**
 * Cột tùy chọn, chỉ xuất khi người dùng chọn (không nằm trong mặc định 31 cột).
 * Khớp các cột "Tất cả cột" của bảng garage-cases.
 */
export const COMPLETED_CASES_OPTIONAL_COLUMNS: ExcelReportColumnDef[] = [
  {
    header: 'Quy tắc loại trừ',
    key: 'exclusionRules',
    width: 26,
    align: 'left',
  },
  { header: 'Số khung', key: 'soKhung', width: 20, align: 'left' },
  { header: 'Hãng xe', key: 'hangXe', width: 16, align: 'left' },
  { header: 'Dòng xe', key: 'dongXe', width: 18, align: 'left' },
  {
    header: 'Năm SX',
    key: 'namSanXuat',
    width: 10,
    align: 'center',
    style: { numFmt: '0' },
  },
  {
    header: 'Đối tượng thanh toán',
    key: 'doiTuongThanhToan',
    width: 28,
    align: 'left',
  },
  {
    header: 'Ngày tạo',
    key: 'createdAt',
    width: 18,
    align: 'center',
    style: { numFmt: 'dd/mm/yyyy hh:mm' },
  },
  {
    header: 'Ngày cập nhật',
    key: 'updatedAt',
    width: 18,
    align: 'center',
    style: { numFmt: 'dd/mm/yyyy hh:mm' },
  },
  {
    header: 'Dữ liệu lúc',
    key: 'dataAsOf',
    width: 18,
    align: 'center',
    style: { numFmt: 'dd/mm/yyyy hh:mm' },
  },
];

/** Toàn bộ cột có thể xuất: mặc định 31 cột + cột tùy chọn. */
export const COMPLETED_CASES_ALL_COLUMNS: ExcelReportColumnDef[] = [
  ...COMPLETED_CASES_COLUMNS,
  ...COMPLETED_CASES_OPTIONAL_COLUMNS,
];

/** Key hợp lệ cho `selectedColumns` của bảng kê phiếu dịch vụ. */
export const COMPLETED_CASES_EXPORT_COLUMN_KEYS: string[] =
  COMPLETED_CASES_ALL_COLUMNS.map((column) => column.key);
