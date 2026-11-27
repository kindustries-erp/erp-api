import type { GarageCashflowQrFieldsDto } from '../dto/garage-cashflow-qr.dto';

export const GARAGE_CASHFLOW_QR_KEYS = [
  'qrCompanyAccountId',
  'qrBankBin',
  'qrBankCode',
  'qrAccountNumber',
  'qrAccountName',
  'qrTransferContent',
] as const satisfies ReadonlyArray<keyof GarageCashflowQrFieldsDto>;

export type GarageCashflowQrFields = {
  [K in (typeof GARAGE_CASHFLOW_QR_KEYS)[number]]?: string | null;
};

/**
 * Lấy thông tin thanh toán QR từ DTO để ghi phiếu: chỉ khóa có gửi lên, cắt khoảng trắng,
 * chuỗi rỗng thành `null`. Khóa không gửi thì bỏ qua (giữ giá trị cũ khi cập nhật).
 */
export function pickVoucherQrFields(
  dto: GarageCashflowQrFieldsDto,
): GarageCashflowQrFields {
  const out: GarageCashflowQrFields = {};
  for (const key of GARAGE_CASHFLOW_QR_KEYS) {
    const raw = dto[key];
    if (raw === undefined) continue;
    const value = typeof raw === 'string' ? raw.trim() : raw;
    out[key] = value ? value : null;
  }
  return out;
}
