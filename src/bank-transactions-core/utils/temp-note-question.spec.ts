import { hasThuTienQuestion, stripThuTienQuestion } from './temp-note-question';

describe('stripThuTienQuestion', () => {
  it('clears a note that is only the accountant question, including typo variants', () => {
    expect(
      stripThuTienQuestion('Thu tiền của đối tượng nào? Hóa đơn số bao nhiêu?'),
    ).toBeNull();
    expect(
      stripThuTienQuestion('Thu tiền của đối tương nào? Hóa đơn số bao nhiêu?'),
    ).toBeNull();
    expect(
      stripThuTienQuestion('Thu tiền của đối tường nào? Hóa đơn số bao nhiêu?'),
    ).toBeNull();
  });

  it('keeps other text of the note and removes only the question', () => {
    expect(
      stripThuTienQuestion(
        'Số tiền trên hóa đơn không trùng khớp\nThu tiền của đối tương nào? Hóa đơn số bao nhiêu?',
      ),
    ).toBe('Số tiền trên hóa đơn không trùng khớp');
  });

  it('leaves other temporary notes untouched', () => {
    expect(stripThuTienQuestion('Cung cấp hợp đồng vay')).toBe(
      'Cung cấp hợp đồng vay',
    );
    expect(
      stripThuTienQuestion('Chi tiền cho NCC nào? Hóa đơn số bao nhiêu?'),
    ).toBe('Chi tiền cho NCC nào? Hóa đơn số bao nhiêu?');
    expect(stripThuTienQuestion(null)).toBeNull();
  });

  it('detects the question', () => {
    expect(
      hasThuTienQuestion('Thu tiền của đối tượng nào? Hóa đơn số bao nhiêu?'),
    ).toBe(true);
    expect(hasThuTienQuestion('Cần cung cấp hóa đơn')).toBe(false);
  });
});
