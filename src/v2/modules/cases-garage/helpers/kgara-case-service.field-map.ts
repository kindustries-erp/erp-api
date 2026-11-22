import type { FieldMapEntry, IgnoredColumn } from './kgara-field-map.engine';

const f = (
  from: string,
  to: string,
  kind: FieldMapEntry['kind'],
  group: FieldMapEntry['group'] = 'source',
): FieldMapEntry => ({ from, to, kind, group });

/** Từ điển `kgara_case_services` (V1) → `case_lines_garage` (v2). */
export const KGARA_CASE_SERVICE_FIELD_MAP: readonly FieldMapEntry[] = [
  f('hdPhieuDichVuChiTietId', 'externalId', 'text', 'identity'),
  f('accountKey', 'accountKey', 'text', 'identity'),
  f('deletedAt', 'externalDeletedAt', 'date'),
  f('noiDungChiTiet', 'description', 'text'),
  f('sanPhamCode', 'productCode', 'text'),
  f('sanPhamName', 'productName', 'text'),
  f('loaiSanPhamCode', 'productTypeCode', 'text'),
  f('donViTinhText', 'unitName', 'text'),
  f('soLuongHoaDon', 'quantity', 'quantity'),
  f('donGia', 'unitPrice', 'money'),
  f('tienChuaThue', 'amountBeforeTax', 'money'),
  f('thueSuat', 'taxRate', 'money'),
  f('tienCoThue', 'amountWithTax', 'money'),
  f('soGioCongLam', 'laborHours', 'money'),
  f('tienDichVu', 'serviceAmount', 'money'),
  f('tienPhuTung', 'partsAmount', 'money'),
  f('giaVonPhuTung', 'partsCost', 'money'),
  f('tyLeChietKhauCt', 'lineDiscountRate', 'money'),
  f('tienChietKhauCt', 'lineDiscountAmount', 'money'),
  f('tienPhuPhi', 'surchargeAmount', 'money'),
  f('khoCode', 'warehouseCode', 'text'),
  f('createdAt', 'createdAt', 'date', 'identity'),
  f('updatedAt', 'updatedAt', 'date', 'identity'),
];

export const KGARA_CASE_SERVICE_IGNORED_COLUMNS: readonly IgnoredColumn[] = [
  {
    property: 'id',
    reason: 'Id nội bộ v1; v2 nối dòng bằng `(accountKey, externalId)`',
  },
  {
    property: 'hdPhieuDichVuId',
    reason: 'Khóa cha KGara; v2 dùng `caseId` (FK nội bộ) do projector tra',
  },
  { property: 'rawData', reason: 'Payload thô KGara, v2 không lưu raw_data' },
];
