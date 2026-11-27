/**
 * Sinh tên file Excel bảng kê phiếu dịch vụ chuẩn hóa kèm phân loại và trạng thái
 * Format: Bang_ke_phieu_dich_vu_{PhanLoai}_{TrangThai}_{YYYYMMDD}_{HHmmss}.xlsx
 */
export function buildGarageCaseExportFileName(
  classification?: string,
  status?: string,
  date: Date = new Date(),
): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const y = date.getFullYear();
  const m = pad(date.getMonth() + 1);
  const d = pad(date.getDate());
  const hh = pad(date.getHours());
  const mm = pad(date.getMinutes());
  const ss = pad(date.getSeconds());
  const timestamp = `${y}${m}${d}_${hh}${mm}${ss}`;

  let classLabel = 'Tat_ca_phan_loai';
  if (classification && classification !== 'ALL') {
    switch (classification) {
      case 'KY_GUI_NOI_BO':
        classLabel = 'Ky_gui_noi_bo';
        break;
      case 'SUA_CHUA_CHUNG':
        classLabel = 'Sua_chua_chung';
        break;
      case 'OJ':
      case 'OJ_NGOAI':
        classLabel = 'OJ';
        break;
      case 'KHAC':
        classLabel = 'Khac';
        break;
      default:
        classLabel = classification.replace(/[^a-zA-Z0-9_-]/g, '_');
    }
  }

  let statusLabel = 'Ket_thuc';
  if (status) {
    if (status.toLowerCase() === 'all') {
      statusLabel = 'Tat_ca_trang_thai';
    } else if (status.toLowerCase() === 'completed') {
      statusLabel = 'Ket_thuc';
    } else {
      statusLabel = status.replace(/[^a-zA-Z0-9_-]/g, '_');
    }
  }

  return `Bang_ke_phieu_dich_vu_${classLabel}_${statusLabel}_${timestamp}.xlsx`;
}
