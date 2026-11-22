import type { FieldMapEntry, IgnoredColumn } from './kgara-field-map.engine';

const f = (
  from: string,
  to: string,
  kind: FieldMapEntry['kind'],
  group: FieldMapEntry['group'] = 'source',
): FieldMapEntry => ({ from, to, kind, group });

/**
 * Từ điển `kgara_cases` (V1, snake_case VN) → `cases_garage` (v2, camelCase EN).
 * Nguồn sự thật duy nhất cho projector và backfill. Mọi field nhóm `source` sửa đè được ở v2.
 */
export const KGARA_CASE_FIELD_MAP: readonly FieldMapEntry[] = [
  f('hdPhieuDichVuId', 'externalId', 'text', 'identity'),
  f('soChungTu', 'caseCode', 'text', 'identity'),
  f('branchExternalId', 'branchExternalId', 'text', 'identity'),
  f('accountKey', 'accountKey', 'text', 'identity'),
  f('bienSoXe', 'licensePlate', 'text'),
  f('soKhung', 'chassisNumber', 'text'),
  f('hangXeCode', 'vehicleBrandCode', 'text'),
  f('hangXeName', 'vehicleBrandName', 'text'),
  f('dongXeCode', 'vehicleModelCode', 'text'),
  f('dongXeName', 'vehicleModelName', 'text'),
  f('namSanXuat', 'manufactureYear', 'int'),
  f('khachHangCode', 'customerCode', 'text'),
  f('khachHangName', 'customerName', 'text'),
  f('kgaraClassification', 'customerSourceName', 'text'),
  f('kgaraClassificationCode', 'customerSourceCode', 'text'),
  f('doiTuongThanhToanCode', 'payerCode', 'text'),
  f('doiTuongThanhToanName', 'payerName', 'text'),
  f('tinhTrangDichVu', 'kgaraStatusCode', 'int'),
  f('tenTinhTrangDichVu', 'statusName', 'text'),
  f('ngayPhatSinh', 'issuedAt', 'vnLocalDateTime'),
  f('ngayTiepNhan', 'receivedAt', 'vnLocalDateTime'),
  f('ngayHoanThanhCongViec', 'completedAt', 'vnLocalDateTime'),
  f('ngayGiaoXeFull', 'deliveredAt', 'vnLocalDateTime'),
  f('tienCoThue', 'totalAmountWithTax', 'money'),
  f('tienDaThanhToan', 'paidAmount', 'money'),
  f('tienConPhaiThanhToan', 'outstandingAmount', 'money'),
  f('doanhThu', 'revenue', 'money'),
  f('chiPhi', 'cost', 'money'),
  f('loiNhuan', 'profit', 'money'),
  f('categoryId', 'categoryId', 'copy'),
  f('classification', 'classification', 'text'),
  f('classificationManuallyCleared', 'classificationManuallyCleared', 'bool'),
  f('excludeFromReports', 'excludeFromReports', 'bool'),
  f('excludeFromDebt', 'excludeFromDebt', 'bool'),
  f('erpNotes', 'internalNotes', 'text'),
  f('kgaraDeletedAt', 'externalDeletedAt', 'date'),
  f('createdAt', 'createdAt', 'date', 'identity'),
  f('updatedAt', 'updatedAt', 'date', 'identity'),
];

/** Cột V1 cố ý không chép sang v2 (kèm lý do). */
export const KGARA_CASE_IGNORED_COLUMNS: readonly IgnoredColumn[] = [
  {
    property: 'id',
    reason: 'Xử lý riêng: thành `id` của v2 (cùng UUID)',
  },
  {
    property: 'rawData',
    reason:
      'Payload thô KGara, v2 không lưu raw_data; nhóm tiến độ đọc riêng ở `kgaraRawProgress`',
  },
  {
    property: 'kgaraDeleteCount',
    reason: 'Bộ đếm lần xóa phía KGara, v2 không dùng',
  },
  {
    property: 'dataAsOf',
    reason: 'Mốc thời gian phản hồi sync, không phải dữ liệu nghiệp vụ',
  },
];

/**
 * Nhóm tiến độ đọc từ `kgara_cases.raw_data` (khóa PascalCase của KGara, không có cột riêng ở V1).
 * Ngày là giờ tường VN không kèm múi giờ. Hiện KGara thường để trống `NgayDuKienHoanThanh`,
 * `YeuCauDichVu`, `ChanDoan`; v2 nhập tay và sync tôn trọng override.
 */
export const KGARA_CASE_RAW_PROGRESS_MAP: readonly FieldMapEntry[] = [
  f('NgayBatDauSuaChua', 'startedAt', 'vnLocalDateTime'),
  f('NgayDuKienHoanThanh', 'expectedCompletionAt', 'vnLocalDateTime'),
  f('YeuCauDichVu', 'requestDescription', 'text'),
  f('ChanDoan', 'diagnosis', 'text'),
  f('NhanVienCoVanDichVuCode', 'advisorCode', 'text'),
  f('NhanVienCoVanDichVuName', 'advisorName', 'text'),
];
