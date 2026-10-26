import {
  CashflowClassification,
  isPurposeAllowed,
} from '../constants/cashflow-attributes.constants';

export const INSURANCE_NOTE = 'Bảo hiểm';

export type NoteCleanupAction = 'clear_note' | 'convert_insurance' | 'skip';

export interface NoteCleanupRow {
  cashflowClassification: string | null;
  cashflowPurpose: string | null;
  note: string | null;
}

/**
 * Lập kế hoạch dọn ghi chú tạm của sao kê Q1/2026 (chỉ thuần logic, không ghi DB).
 * - Mục đích "bồi thường bảo hiểm" → đổi thành "khách hàng thanh toán", ghi chú = "Bảo hiểm".
 * - Dòng khác đã phân loại có ghi chú tạm → xoá ghi chú.
 * - Dòng chưa phân loại, hoặc đã là "Bảo hiểm" → giữ nguyên (idempotent).
 */
export const planNoteCleanup = (row: NoteCleanupRow): NoteCleanupAction => {
  if (!row.cashflowClassification || !row.cashflowPurpose) return 'skip';

  const note = (row.note ?? '').trim();
  if (note === INSURANCE_NOTE) return 'skip';

  if (row.cashflowPurpose === 'INSURANCE_CLAIM') {
    const classification = row.cashflowClassification as CashflowClassification;
    return isPurposeAllowed(classification, 'CUSTOMER_PAYMENT')
      ? 'convert_insurance'
      : 'skip';
  }

  return note ? 'clear_note' : 'skip';
};
