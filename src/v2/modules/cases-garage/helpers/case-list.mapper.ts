import { toMoney } from '@/v2/core/debts-core';
import { extractNetPayableAmount } from '@/kgara-api-core/utils/kgara-parser.util';
import type { KgaraCase } from '@/kgara-api-core/entities/kgara_case.entity';
import type { CaseListItem } from '../dto/case-list.types';

export interface CaseSettlementSums {
  receipts: number;
  payments: number;
}

export interface CaseLinkCounts {
  total: number;
  outCount: number;
  inCount: number;
}

/** Lãi gộp khớp theo mã (nếu có) dùng làm giá trị dự phòng cho doanh thu, chi phí, lợi nhuận. */
export interface CaseGrossProfitRef {
  doanhThu: number | string | null;
  chiPhi: number | string | null;
  loiNhuan: number | string | null;
}

type Raw = Record<string, unknown> | null | undefined;
const numOrNull = (v: unknown) => (v == null ? null : toMoney(v as number));
const iso = (v: Date | string | null | undefined) =>
  v == null ? null : v instanceof Date ? v.toISOString() : v;

/** Số phải thu của bảo hiểm, theo quy tắc V1 trên `raw_data`. */
export function insuranceReceivable(raw: Raw): number {
  const paidByInsurer = raw?.TienThanhToanBH;
  if (paidByInsurer != null && !isNaN(Number(paidByInsurer))) {
    return Number(paidByInsurer);
  }
  const approved = Number(raw?.TienBaoHiemDuyet);
  if (raw?.XeLamBaoHiem === true && approved > 0) return approved;
  return 0;
}

/** Số phải thu của khách hàng, theo quy tắc V1 trên `raw_data`. */
export function customerReceivable(
  raw: Raw,
  netPayable: number,
  insurance: number,
): number {
  const paidByCustomer = raw?.TienThanhToanKH;
  if (paidByCustomer != null && !isNaN(Number(paidByCustomer))) {
    return Number(paidByCustomer);
  }
  if (!raw?.XeLamBaoHiem) return netPayable;
  return Math.max(0, netPayable - insurance);
}

/** Ghép một vụ việc với tổng cấn trừ, hóa đơn liên kết và lãi gộp thành dòng danh sách. */
export function toCaseListItem(
  item: KgaraCase,
  settlement: CaseSettlementSums | undefined,
  links: CaseLinkCounts | undefined,
  gp: CaseGrossProfitRef | null | undefined,
): CaseListItem {
  const doanhThu = numOrNull(item.doanhThu ?? gp?.doanhThu);
  const chiPhi = numOrNull(item.chiPhi ?? gp?.chiPhi);
  const loiNhuan = numOrNull(item.loiNhuan ?? gp?.loiNhuan);
  const netPayable = toMoney(extractNetPayableAmount(item));
  const paid = settlement ? settlement.receipts : toMoney(item.tienDaThanhToan);
  const raw = item.rawData as Raw;
  const insurance = insuranceReceivable(raw);

  return {
    id: item.id,
    hdPhieuDichVuId: item.hdPhieuDichVuId,
    soChungTu: item.soChungTu,
    bienSoXe: item.bienSoXe,
    khachHangCode: item.khachHangCode,
    khachHangName: item.khachHangName,
    branchExternalId: item.branchExternalId ?? null,
    tinhTrangDichVu: item.tinhTrangDichVu,
    tenTinhTrangDichVu: item.tenTinhTrangDichVu,
    classification: item.category?.code ?? item.classification ?? null,
    category: item.category
      ? {
          id: item.category.id,
          code: item.category.code ?? null,
          name: item.category.name ?? null,
        }
      : null,
    excludeFromReports: item.excludeFromReports,
    excludeFromDebt: item.excludeFromDebt,
    ngayPhatSinh: iso(item.ngayPhatSinh),
    ngayTiepNhan: iso(item.ngayTiepNhan),
    ngayHoanThanhCongViec: iso(item.ngayHoanThanhCongViec),
    doanhThu,
    chiPhi,
    loiNhuan,
    margin:
      doanhThu && doanhThu > 0 && loiNhuan != null
        ? (loiNhuan / doanhThu) * 100
        : null,
    tienCoThue: netPayable,
    tienDaThanhToan: paid,
    tienConPhaiThanhToan: Math.max(0, netPayable - paid),
    tienDaChi: settlement ? settlement.payments : 0,
    phaiThuKhachHang: customerReceivable(raw, netPayable, insurance),
    phaiThuBaoHiem: insurance,
    linkedInvoiceCount: links?.total ?? 0,
    linkedInvoiceOutCount: links?.outCount ?? 0,
    linkedInvoiceInCount: links?.inCount ?? 0,
  };
}
