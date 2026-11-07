import type { KgaraCashflowVoucherResponseDto } from '@/kgara-api-core/dto/garage-cashflow.dto';
import type { CashflowForecast } from '@/v2/core/cashflow-core';
import type { CashflowGarageForecastExt } from '../entities/cashflow-garage-forecast-ext.entity';

/**
 * Lớp tương thích cho route cũ `/api/v1/greenway/cashflow-vouchers`.
 * Hàm thuần, không đọc DB. Dùng để dựng response cũ từ dự thu/dự chi mới.
 * Xóa cùng đợt với route cũ (P6).
 */

/** Dự thu (IN) là RECEIPT, dự chi (OUT) là PAYMENT. */
export function toLegacyVoucherType(
  direction: 'IN' | 'OUT',
): 'RECEIPT' | 'PAYMENT' {
  return direction === 'IN' ? 'RECEIPT' : 'PAYMENT';
}

/**
 * Trạng thái cũ theo chiều dòng tiền.
 * - Dự chi: DRAFT, PENDING_APPROVAL, REJECTED -> PENDING; OPEN, PARTIAL -> APPROVED; SETTLED -> PAID.
 * - Dự thu: DRAFT, OPEN, PARTIAL, PENDING_APPROVAL, REJECTED -> EXPECTED; SETTLED -> PAID.
 * - CANCELLED -> CANCELLED cho cả hai.
 * Lưu ý: dữ liệu cũ có dự thu paymentStatus = NULL nhưng nghĩa là đã thu. Backfill ghi rõ PAID, không suy ngược.
 */
export function toLegacyPaymentStatus(
  direction: 'IN' | 'OUT',
  status: string,
): NonNullable<KgaraCashflowVoucherResponseDto['paymentStatus']> {
  if (status === 'CANCELLED') return 'CANCELLED';
  if (status === 'SETTLED') return 'PAID';
  if (direction === 'IN') return 'EXPECTED';
  if (status === 'OPEN' || status === 'PARTIAL') return 'APPROVED';
  return 'PENDING';
}

export interface LegacyVoucherSource {
  header: CashflowForecast;
  ext: CashflowGarageForecastExt | null;
  /** Ngày giao dịch cũ: ngày thực thu/chi nếu đã có, không thì ngày dự kiến. */
  transDate: string;
  paymentMethod?: string | null;
  referenceNumber?: string | null;
  /** Liên kết giao dịch ngân hàng từ thực thu/chi (nếu có). */
  erpBankTransactionId?: string | null;
  caseRow?: {
    id: string;
    khachHangName?: string | null;
    khachHangCode?: string | null;
    soChungTu?: string | null;
    bienSoXe?: string | null;
  } | null;
  bankRow?: {
    id: string;
    referenceNumber?: string | null;
    seqNo?: string | null;
  } | null;
}

function iso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : String(value);
}

export function toLegacyVoucherResponse(
  source: LegacyVoucherSource,
): KgaraCashflowVoucherResponseDto {
  const { header, ext } = source;
  const direction = header.direction;
  return {
    id: header.id,
    voucherCode: header.code,
    voucherType: toLegacyVoucherType(direction),
    amount: Number(header.amount) || 0,
    transDate: source.transDate,
    partnerName: header.partnerName ?? null,
    partnerPhone: null,
    licensePlate: ext?.licensePlate ?? null,
    note: header.note ?? null,
    paymentMethod: ext?.legacyPaymentMethod ?? source.paymentMethod ?? null,
    paymentContent: ext?.paymentContent ?? null,
    paymentStatus: toLegacyPaymentStatus(direction, header.status),
    referenceNumber: source.referenceNumber ?? null,
    caseId: ext?.caseId ?? null,
    erpBankTransactionId: source.erpBankTransactionId ?? null,
    erpCashVoucherId: null,
    createdBy: ext?.legacyCreatedBy ?? header.createdBy ?? null,
    isAutoCommission: ext?.isAutoCommission ?? false,
    isAutoExpected: ext?.isAutoExpected ?? false,
    pnlPeriodYear: ext?.pnlPeriodYear ?? null,
    pnlPeriodMonth: ext?.pnlPeriodMonth ?? null,
    pnlCommissionType: ext?.pnlCommissionType ?? null,
    pnlCommissionAnchorId: ext?.pnlCommissionAnchorId ?? null,
    createdAt: iso(header.createdAt),
    updatedAt: iso(header.updatedAt),
    case: source.caseRow
      ? {
          id: source.caseRow.id,
          khachHangName: source.caseRow.khachHangName ?? null,
          khachHangCode: source.caseRow.khachHangCode ?? null,
          soChungTu: source.caseRow.soChungTu ?? null,
          bienSoXe: source.caseRow.bienSoXe ?? null,
        }
      : null,
    erpBankTransaction: source.bankRow
      ? {
          id: source.bankRow.id,
          referenceNumber: source.bankRow.referenceNumber ?? null,
          seqNo: source.bankRow.seqNo ?? null,
        }
      : null,
  };
}
