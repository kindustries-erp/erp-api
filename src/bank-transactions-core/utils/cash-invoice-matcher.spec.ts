import type { CashReceipt } from './cash-sheet-reader';
import {
  matchReceiptsToInvoices,
  type OpenInvoice,
} from './cash-invoice-matcher';

const receipt = (
  row: number,
  amount: number,
  date = '2026-05-01',
  plate = '50H12345',
): CashReceipt => ({ row, date, plate, amount });

const invoice = (
  id: string,
  remaining: number,
  invoiceDate = '2026-05-02',
  plate = '50H12345',
): OpenInvoice => ({
  id,
  invoiceNo: id,
  invoiceDate,
  plate,
  remaining,
});

describe('matchReceiptsToInvoices', () => {
  it('ghép khớp tuyệt đối với grade EXACT', () => {
    const r = matchReceiptsToInvoices(
      [receipt(1, 540000)],
      [invoice('A', 540000)],
    );
    expect(r.matches).toHaveLength(1);
    expect(r.matches[0]).toMatchObject({
      allocated: 540000,
      diff: 0,
      grade: 'EXACT',
    });
    expect(r.unmatched).toHaveLength(0);
  });

  it('thu hơn HĐ dưới 1.000đ → NEAR, cấn trừ đúng bằng số còn lại', () => {
    const r = matchReceiptsToInvoices(
      [receipt(1, 1117000)],
      [invoice('A', 1116500)],
    );
    expect(r.matches[0]).toMatchObject({
      allocated: 1116500,
      diff: 500,
      grade: 'NEAR',
    });
  });

  it('thu kém HĐ → diff âm, cấn trừ bằng tiền thu', () => {
    const r = matchReceiptsToInvoices(
      [receipt(1, 4749000)],
      [invoice('A', 4748901)],
    );
    expect(r.matches[0]).toMatchObject({
      allocated: 4748901,
      diff: 99,
      grade: 'NEAR',
    });
    const r2 = matchReceiptsToInvoices(
      [receipt(1, 540000)],
      [invoice('A', 540500)],
    );
    expect(r2.matches[0].diff).toBe(-500);
  });

  it('lệch từ 1.000 đến dưới 10.000đ → WIDE, vẫn được ghép', () => {
    const r = matchReceiptsToInvoices(
      [receipt(1, 210000)],
      [invoice('A', 205000)],
    );
    expect(r.matches[0]).toMatchObject({ diff: 5000, grade: 'WIDE' });
  });

  it('lệch đúng 10.000đ hoặc hơn bị loại (NO_CANDIDATE)', () => {
    const r = matchReceiptsToInvoices(
      [receipt(1, 210000)],
      [invoice('A', 200000)],
    );
    expect(r.matches).toHaveLength(0);
    expect(r.unmatched[0].reason).toBe('NO_CANDIDATE');
  });

  it('hóa đơn xuất trước ngày thu bị loại', () => {
    const r = matchReceiptsToInvoices(
      [receipt(1, 108000, '2026-05-10')],
      [invoice('A', 108000, '2026-05-09')],
    );
    expect(r.matches).toHaveLength(0);
    expect(r.unmatched[0].reason).toBe('NO_CANDIDATE');
  });

  it('hóa đơn cùng ngày thu vẫn hợp lệ', () => {
    const r = matchReceiptsToInvoices(
      [receipt(1, 108000, '2026-05-10')],
      [invoice('A', 108000, '2026-05-10')],
    );
    expect(r.matches).toHaveLength(1);
  });

  it('khác biển số thì không ghép', () => {
    const r = matchReceiptsToInvoices(
      [receipt(1, 108000, '2026-05-01', '50H12345')],
      [invoice('A', 108000, '2026-05-02', '50H12346')],
    );
    expect(r.matches).toHaveLength(0);
  });

  it('mỗi hóa đơn chỉ được ghép một lần; khoản thu thứ hai báo CONFLICT', () => {
    const r = matchReceiptsToInvoices(
      [receipt(1, 162000), receipt(2, 162000)],
      [invoice('A', 162000)],
    );
    expect(r.matches).toHaveLength(1);
    expect(r.unmatched).toEqual([
      expect.objectContaining({ reason: 'CONFLICT' }),
    ]);
  });

  it('hai hóa đơn cùng độ lệch nhỏ nhất → AMBIGUOUS, không tự ghép', () => {
    const r = matchReceiptsToInvoices(
      [receipt(1, 430000)],
      [invoice('A', 430000), invoice('B', 430000)],
    );
    expect(r.matches).toHaveLength(0);
    expect(r.unmatched[0].reason).toBe('AMBIGUOUS');
  });

  it('chọn hóa đơn có độ lệch nhỏ hơn khi hai ứng viên khác độ lệch', () => {
    const r = matchReceiptsToInvoices(
      [receipt(1, 430000)],
      [invoice('A', 429000), invoice('B', 430000)],
    );
    expect(r.matches[0].invoice.id).toBe('B');
  });

  it('xử lý khoản thu theo ngày trước, không phụ thuộc thứ tự truyền vào', () => {
    const r = matchReceiptsToInvoices(
      [receipt(2, 108500, '2026-06-01'), receipt(1, 108000, '2026-05-01')],
      [invoice('A', 108500, '2026-06-02'), invoice('B', 108000, '2026-05-02')],
    );
    const byRow = Object.fromEntries(
      r.matches.map((m) => [m.receipt.row, m.invoice.id]),
    );
    expect(byRow).toEqual({ 1: 'B', 2: 'A' });
  });

  it('tính theo cent: số thập phân không gây lệch giả', () => {
    const r = matchReceiptsToInvoices(
      [receipt(1, 100000)],
      [invoice('A', 99999.99)],
    );
    expect(r.matches[0]).toMatchObject({ diff: 0.01, grade: 'EXACT' });
  });
});
