import { INSURANCE_NOTE, planNoteCleanup } from './q1-note-cleanup';

describe('planNoteCleanup', () => {
  it('bồi thường bảo hiểm có ghi chú tạm → đổi sang khách hàng thanh toán', () => {
    expect(
      planNoteCleanup({
        cashflowClassification: 'OPERATING',
        cashflowPurpose: 'INSURANCE_CLAIM',
        note: 'Hóa đơn nào',
      }),
    ).toBe('convert_insurance');
  });

  it('bồi thường bảo hiểm không có ghi chú → vẫn đổi mục đích', () => {
    expect(
      planNoteCleanup({
        cashflowClassification: 'OPERATING',
        cashflowPurpose: 'INSURANCE_CLAIM',
        note: null,
      }),
    ).toBe('convert_insurance');
  });

  it('mục đích khác đã phân loại có ghi chú tạm → xoá ghi chú', () => {
    expect(
      planNoteCleanup({
        cashflowClassification: 'OPERATING',
        cashflowPurpose: 'CUSTOMER_PAYMENT',
        note: 'Check',
      }),
    ).toBe('clear_note');
  });

  it('ghi chú chỉ toàn khoảng trắng không được coi là có nội dung', () => {
    expect(
      planNoteCleanup({
        cashflowClassification: 'OPERATING',
        cashflowPurpose: 'SALARY',
        note: '   ',
      }),
    ).toBe('skip');
  });

  it('dòng chưa phân loại hoặc chưa có mục đích → giữ nguyên', () => {
    expect(
      planNoteCleanup({
        cashflowClassification: null,
        cashflowPurpose: null,
        note: 'Check',
      }),
    ).toBe('skip');
    expect(
      planNoteCleanup({
        cashflowClassification: 'OPERATING',
        cashflowPurpose: null,
        note: 'Check',
      }),
    ).toBe('skip');
  });

  it('dòng đã là "Bảo hiểm" → skip (chạy lại không xoá)', () => {
    expect(
      planNoteCleanup({
        cashflowClassification: 'OPERATING',
        cashflowPurpose: 'CUSTOMER_PAYMENT',
        note: INSURANCE_NOTE,
      }),
    ).toBe('skip');
  });
});
