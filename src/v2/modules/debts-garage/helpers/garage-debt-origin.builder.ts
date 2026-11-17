import { toMoney, type UpsertDebtOriginCommand } from '@/v2/core/debts-core';
import { resolveStoredNetPayable } from '@/kgara-api-core/utils/kgara-parser.util';
import type { KgaraCase } from '@/kgara-api-core/entities/kgara_case.entity';
import { insuranceReceivable } from '@/v2/modules/cases-garage/helpers/case-list.mapper';
import { GARAGE_DEBT_BASELINE_DATE } from './garage-debt-sql.helper';

/** Hãng bảo hiểm / NCC chưa xác định; người dùng gán sau qua `PATCH ledger/:debtId/party`. */
export const INSURER_UNKNOWN_CODE = 'BH_CHUA_XAC_DINH';
export const SUPPLIER_UNKNOWN_CODE = 'NCC_CHUA_XAC_DINH';

export type CaseDebtKey = Pick<
  UpsertDebtOriginCommand,
  'direction' | 'partyType'
>;

/** Ba khoản nợ tối đa một vụ việc có thể sinh ra. */
export const CASE_DEBT_KEYS: ReadonlyArray<CaseDebtKey> = [
  { direction: 'RECEIVABLE', partyType: 'CUSTOMER' },
  { direction: 'RECEIVABLE', partyType: 'INSURER' },
  { direction: 'PAYABLE', partyType: 'SUPPLIER' },
];

type CaseDebtSource = Pick<
  KgaraCase,
  | 'id'
  | 'branchExternalId'
  | 'bienSoXe'
  | 'khachHangCode'
  | 'khachHangName'
  | 'tinhTrangDichVu'
  | 'tenTinhTrangDichVu'
  | 'tienCoThue'
  | 'chiPhi'
  | 'ngayHoanThanhCongViec'
  | 'ngayPhatSinh'
  | 'excludeFromReports'
  | 'excludeFromDebt'
  | 'kgaraDeletedAt'
  | 'rawData'
>;

const dateOnly = (d: Date | string | null | undefined): string | null =>
  d ? new Date(d).toISOString().slice(0, 10) : null;

/** Cùng điều kiện với `COMPLETED_CASE_CONDITIONS` ở lớp đọc (tính bằng TS thay vì SQL). */
function isCompleted(c: CaseDebtSource): boolean {
  if (c.kgaraDeletedAt || c.excludeFromReports || c.excludeFromDebt) {
    return false;
  }
  const name = (c.tenTinhTrangDichVu ?? '').toLowerCase();
  const done =
    c.tinhTrangDichVu === 3 ||
    name === 'kết thúc' ||
    name.includes('kết thúc') ||
    name.includes('hoàn tất');
  return done && !!c.ngayHoanThanhCongViec;
}

/**
 * Nợ gốc của một vụ việc, đúng công thức lớp đọc hiện tại:
 * - Phải thu = số ròng sau chiết khấu; vụ bảo hiểm tách thành INSURER (chặn trên bằng tổng) + CUSTOMER (phần còn lại).
 * - Phải trả = `COALESCE(gp.chi_phi, c.chi_phi)` của phiếu đã Kết thúc (3).
 * Vụ việc không đủ điều kiện trả mảng rỗng; người gọi void các dòng cũ bằng `CASE_DEBT_KEYS`.
 */
export function buildCaseDebtOrigins(
  c: CaseDebtSource,
  gpChiPhi: number | string | null,
): UpsertDebtOriginCommand[] {
  if (!isCompleted(c) || !c.branchExternalId) return [];
  const dueBaseDate = dateOnly(c.ngayHoanThanhCongViec);
  if (!dueBaseDate || dueBaseDate < GARAGE_DEBT_BASELINE_DATE) return [];

  const common = {
    branchExternalId: c.branchExternalId,
    sourceType: 'CASE',
    sourceId: c.id,
    caseId: c.id,
    licensePlate: c.bienSoXe?.trim() || null,
    dueBaseDate,
    origin: 'SYNC',
  };
  const out: UpsertDebtOriginCommand[] = [];

  const net = toMoney(resolveStoredNetPayable(c));
  const insurance = Math.min(net, toMoney(insuranceReceivable(c.rawData)));
  if (insurance > 0) {
    out.push({
      ...common,
      direction: 'RECEIVABLE',
      partyType: 'INSURER',
      partyCode: INSURER_UNKNOWN_CODE,
      partyName: null,
      originalAmount: insurance,
    });
  }
  out.push({
    ...common,
    direction: 'RECEIVABLE',
    partyType: 'CUSTOMER',
    partyCode: c.khachHangCode ?? '',
    partyName: c.khachHangName ?? null,
    originalAmount: toMoney(net - insurance),
  });

  const cost = toMoney(gpChiPhi ?? c.chiPhi ?? 0);
  if (c.tinhTrangDichVu === 3 && cost > 0) {
    out.push({
      ...common,
      direction: 'PAYABLE',
      partyType: 'SUPPLIER',
      partyCode: SUPPLIER_UNKNOWN_CODE,
      partyName: null,
      originalAmount: cost,
    });
  }
  return out;
}
