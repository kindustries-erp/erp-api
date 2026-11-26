import { vehicleKey } from '@/common/utils/vehicle-count-sql';

/** Một lệnh (phiếu) trong danh sách `checkpoint-cases`. */
export interface CheckpointCaseItem {
  id: string;
  /** Khóa xe (biển số chuẩn hóa; phiếu không biển khóa theo id), khớp cách đếm xe của dashboard. */
  vehicleKey: string;
  soChungTu: string;
  bienSoXe: string | null;
  khachHangCode: string | null;
  khachHangName: string | null;
  /** Tên khách in trên phiếu (có thể khác tên danh mục). */
  tenKhachHang: string | null;
  tinhTrangDichVu: number | null;
  tenTinhTrangDichVu: string | null;
  classification: string;
  doanhThu: number;
  chiPhi: number;
  loiNhuan: number;
  tienCoThue: number;
  tienDaThanhToan: number;
  tienConPhaiThanhToan: number;
  hasInvoice: boolean;
  ngayHoanThanhCongViec: Date | null;
  ngayPhatSinh: Date | null;
}

/** Một xe trong danh sách `checkpoint-cases` gom theo xe: tổng các lệnh của xe + chi tiết từng lệnh. */
export interface CheckpointVehicleItem {
  vehicleKey: string;
  bienSoXe: string | null;
  khachHangName: string | null;
  classification: string;
  caseCount: number;
  soChungTus: string[];
  doanhThu: number;
  chiPhi: number;
  loiNhuan: number;
  tienCoThue: number;
  tienDaThanhToan: number;
  tienConPhaiThanhToan: number;
  hasInvoice: boolean;
  ngayHoanThanhCongViec: Date | null;
  ngayPhatSinh: Date | null;
  cases: CheckpointCaseItem[];
}

/** Phân loại ERP chuẩn hóa của một phiếu (cùng quy tắc cũ của danh sách). */
function normalizeClass(c: any): string {
  const rawClass = (c.classification || c.category?.code || '')
    .trim()
    .toUpperCase();
  if (rawClass === 'SUA_CHUA_CHUNG') return 'SUA_CHUA_CHUNG';
  if (['KY_GUI_NOI_BO', 'KY_GUI', 'NOI_BO'].includes(rawClass)) {
    return 'KY_GUI_NOI_BO';
  }
  if (
    ['OJ', 'OJ_NGOAI'].includes(rawClass) ||
    c.accountKey === 'OJ' ||
    (c.soChungTu && String(c.soChungTu).startsWith('GN-'))
  ) {
    return 'OJ_NGOAI';
  }
  return 'KHAC';
}

/** Map entity phiếu (kèm `grossProfit` và `category` nếu có) sang dòng lệnh của danh sách. */
export function toCheckpointCaseItem(c: any): CheckpointCaseItem {
  const gp = c.grossProfit;
  const rev = Number(gp?.doanhThu ?? c.doanhThu ?? c.tienCoThue ?? 0);
  const cost = Number(gp?.chiPhi ?? c.chiPhi ?? 0);
  const profit = Number(gp?.loiNhuan ?? c.loiNhuan ?? rev - cost);
  const tienThueKH = Number((c.rawData || {}).TienThueKH ?? 0);

  return {
    id: c.id,
    vehicleKey: vehicleKey(c.bienSoXe, c.id),
    soChungTu: c.soChungTu,
    bienSoXe: c.bienSoXe,
    khachHangCode: c.khachHangCode,
    khachHangName: c.khachHangName,
    tenKhachHang: c.tenKhachHang ?? null,
    tinhTrangDichVu: c.tinhTrangDichVu,
    tenTinhTrangDichVu: c.tenTinhTrangDichVu,
    classification: normalizeClass(c),
    doanhThu: rev,
    chiPhi: cost,
    loiNhuan: profit,
    tienCoThue: Number(c.tienCoThue ?? 0),
    tienDaThanhToan: Number(c.tienDaThanhToan ?? 0),
    tienConPhaiThanhToan: Number(c.tienConPhaiThanhToan ?? 0),
    hasInvoice: tienThueKH > 0,
    ngayHoanThanhCongViec: c.ngayHoanThanhCongViec,
    ngayPhatSinh: c.ngayPhatSinh || c.createdAt,
  };
}

const latest = (a: Date | null, b: Date | null): Date | null => {
  if (!a) return b;
  if (!b) return a;
  return new Date(a).getTime() >= new Date(b).getTime() ? a : b;
};

const sum = (
  cases: CheckpointCaseItem[],
  pick: (c: CheckpointCaseItem) => number,
) => cases.reduce((total, c) => total + pick(c), 0);

/**
 * Gom các lệnh cùng một xe thành một dòng. `cases` phải sắp mới nhất trước (đúng thứ tự truy vấn):
 * biển số, khách hàng và phân loại lấy từ lệnh mới nhất; tiền cộng theo lệnh.
 */
export function toCheckpointVehicleItem(
  key: string,
  cases: CheckpointCaseItem[],
): CheckpointVehicleItem {
  return {
    vehicleKey: key,
    bienSoXe: cases.find((c) => c.bienSoXe)?.bienSoXe ?? null,
    khachHangName: cases.find((c) => c.khachHangName)?.khachHangName ?? null,
    classification: cases[0]?.classification ?? 'KHAC',
    caseCount: cases.length,
    soChungTus: cases.map((c) => c.soChungTu),
    doanhThu: sum(cases, (c) => c.doanhThu),
    chiPhi: sum(cases, (c) => c.chiPhi),
    loiNhuan: sum(cases, (c) => c.loiNhuan),
    tienCoThue: sum(cases, (c) => c.tienCoThue),
    tienDaThanhToan: sum(cases, (c) => c.tienDaThanhToan),
    tienConPhaiThanhToan: sum(cases, (c) => c.tienConPhaiThanhToan),
    hasInvoice: cases.some((c) => c.hasInvoice),
    ngayHoanThanhCongViec: cases.reduce<Date | null>(
      (acc, c) => latest(acc, c.ngayHoanThanhCongViec),
      null,
    ),
    ngayPhatSinh: cases.reduce<Date | null>(
      (acc, c) => latest(acc, c.ngayPhatSinh),
      null,
    ),
    cases,
  };
}

/** Nhóm các lệnh đã map theo khóa xe, giữ thứ tự lệnh trong từng nhóm. */
export function groupCheckpointCasesByVehicle(
  cases: CheckpointCaseItem[],
): Map<string, CheckpointCaseItem[]> {
  const grouped = new Map<string, CheckpointCaseItem[]>();
  for (const item of cases) {
    const bucket = grouped.get(item.vehicleKey);
    if (bucket) bucket.push(item);
    else grouped.set(item.vehicleKey, [item]);
  }
  return grouped;
}
