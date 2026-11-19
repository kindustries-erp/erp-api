import type { FieldMapEntry, IgnoredColumn } from './kgara-field-map.engine';

const f = (
  from: string,
  to: string,
  kind: FieldMapEntry['kind'],
  group: FieldMapEntry['group'] = 'source',
  direction: FieldMapEntry['direction'] = 'v1->v2',
): FieldMapEntry => ({ from, to, kind, group, direction });
const local = (from: string, to: string, kind: FieldMapEntry['kind']) =>
  f(from, to, kind, 'erp-local', 'both');

/**
 * Từ điển `kgara_cases` (V1, snake_case VN) → `cases_garage` (v2, camelCase EN).
 * Nguồn sự thật duy nhất cho projector, mirror ngược và backfill.
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
  f('ngayPhatSinh', 'issuedAt', 'date'),
  f('ngayTiepNhan', 'receivedAt', 'date'),
  f('ngayHoanThanhCongViec', 'completedAt', 'date'),
  f('ngayGiaoXeFull', 'deliveredAt', 'date'),
  f('tienCoThue', 'totalAmountWithTax', 'money'),
  f('tienDaThanhToan', 'paidAmount', 'money'),
  f('tienConPhaiThanhToan', 'outstandingAmount', 'money'),
  f('doanhThu', 'revenue', 'money'),
  f('chiPhi', 'cost', 'money'),
  f('loiNhuan', 'profit', 'money'),
  local('categoryId', 'categoryId', 'copy'),
  local('classification', 'classification', 'text'),
  local(
    'classificationManuallyCleared',
    'classificationManuallyCleared',
    'bool',
  ),
  local('excludeFromReports', 'excludeFromReports', 'bool'),
  local('excludeFromDebt', 'excludeFromDebt', 'bool'),
  local('erpNotes', 'internalNotes', 'text'),
  f('kgaraDeletedAt', 'externalDeletedAt', 'date'),
  f('kgaraDeleteCount', 'externalDeleteCount', 'int'),
  f('createdAt', 'createdAt', 'date', 'identity'),
  f('updatedAt', 'updatedAt', 'date', 'identity'),
];

/** Cột V1 cố ý không chép sang v2 (kèm lý do). */
export const KGARA_CASE_IGNORED_COLUMNS: readonly IgnoredColumn[] = [
  {
    property: 'id',
    reason: 'Xử lý riêng: thành `id` và `legacyCaseId` của v2',
  },
  { property: 'rawData', reason: 'Payload thô KGara, v2 không lưu raw_data' },
  {
    property: 'dataAsOf',
    reason: 'Mốc thời gian phản hồi sync, không phải dữ liệu nghiệp vụ',
  },
];

/** Tên property v2 do ERP-local sở hữu (xe KGARA_SYNC chỉ được sửa nhóm này). */
export const CASE_ERP_LOCAL_FIELDS: readonly string[] =
  KGARA_CASE_FIELD_MAP.filter((e) => e.group === 'erp-local').map((e) => e.to);
