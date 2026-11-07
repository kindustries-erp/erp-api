/**
 * Khóa duyệt của dự thu/dự chi, lưu trong erp_approval_settings theo doc_type.
 * Không có dòng khóa thì dùng mặc định bên dưới: dự chi cần duyệt, dự thu không.
 */
export const CASHFLOW_APPROVAL_DOC_TYPE = {
  FORECAST_OUT: 'CASHFLOW_FORECAST_OUT',
  FORECAST_IN: 'CASHFLOW_FORECAST_IN',
} as const;

export type CashflowApprovalDocType =
  (typeof CASHFLOW_APPROVAL_DOC_TYPE)[keyof typeof CASHFLOW_APPROVAL_DOC_TYPE];

/** Khóa duyệt của một chiều dòng tiền. */
export function forecastApprovalDocType(
  direction: 'IN' | 'OUT',
): CashflowApprovalDocType {
  return direction === 'OUT'
    ? CASHFLOW_APPROVAL_DOC_TYPE.FORECAST_OUT
    : CASHFLOW_APPROVAL_DOC_TYPE.FORECAST_IN;
}

/** Mặc định khi chưa có dòng khóa: dự chi bật (cần duyệt), dự thu tắt. */
export function defaultForecastApprovalEnabled(
  docType: CashflowApprovalDocType,
): boolean {
  return docType === CASHFLOW_APPROVAL_DOC_TYPE.FORECAST_OUT;
}
