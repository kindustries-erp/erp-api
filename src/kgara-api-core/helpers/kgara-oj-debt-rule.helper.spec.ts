import {
  attachOjHasInvoice,
  findOjInvoicedCaseIds,
  isOjClassification,
  ojHasInvoiceOf,
  refreshOjDebtFlag,
  resolveOjExcludeFromDebt,
} from './kgara-oj-debt-rule.helper';

const managerWith = (hasInvoice: boolean) => ({
  query: jest.fn().mockResolvedValue([{ has: hasInvoice }]),
  findOne: jest.fn(),
  update: jest.fn().mockResolvedValue({ affected: 1 }),
});

describe('kgara-oj-debt-rule', () => {
  it('nhận diện OJ gồm cả mã cũ OJ_NGOAI', () => {
    expect(isOjClassification('OJ')).toBe(true);
    expect(isOjClassification('OJ_NGOAI')).toBe(true);
    expect(isOjClassification('SUA_CHUA_CHUNG')).toBe(false);
    expect(isOjClassification(null)).toBe(false);
  });

  it('OJ có hóa đơn đầu ra hiệu lực thì tính công nợ', async () => {
    const m = managerWith(true);
    await expect(resolveOjExcludeFromDebt(m as any, 'c1')).resolves.toBe(false);
    const [sql, params] = m.query.mock.calls[0];
    expect(params).toEqual(['c1']);
    expect(sql).toContain(`l."linkType" = 'OUT'`);
    expect(sql).toContain('i.is_deleted = false');
    expect(sql).toContain('NOT IN (4, 6)');
  });

  it('OJ chưa gắn hóa đơn thì không tính công nợ', async () => {
    const m = managerWith(false);
    await expect(resolveOjExcludeFromDebt(m as any, 'c1')).resolves.toBe(true);
  });

  it('phiếu chưa lưu (chưa có id) thì không tính công nợ, không truy vấn', async () => {
    const m = managerWith(true);
    await expect(resolveOjExcludeFromDebt(m as any, undefined)).resolves.toBe(
      true,
    );
    expect(m.query).not.toHaveBeenCalled();
  });

  it('refresh ghi cờ khi phiếu OJ đổi trạng thái', async () => {
    const m = managerWith(true);
    m.findOne.mockResolvedValue({
      id: 'c1',
      classification: 'OJ',
      excludeFromDebt: true,
    });
    await expect(refreshOjDebtFlag(m as any, 'c1')).resolves.toBe(true);
    expect(m.update).toHaveBeenCalledWith(expect.anything(), 'c1', {
      excludeFromDebt: false,
    });
  });

  it('refresh không ghi khi cờ đã đúng', async () => {
    const m = managerWith(false);
    m.findOne.mockResolvedValue({
      id: 'c1',
      classification: 'OJ',
      excludeFromDebt: true,
    });
    await expect(refreshOjDebtFlag(m as any, 'c1')).resolves.toBe(false);
    expect(m.update).not.toHaveBeenCalled();
  });

  it('refresh bỏ qua phiếu không phải OJ', async () => {
    const m = managerWith(true);
    m.findOne.mockResolvedValue({
      id: 'c1',
      classification: 'KY_GUI_NOI_BO',
      excludeFromDebt: true,
    });
    await expect(refreshOjDebtFlag(m as any, 'c1')).resolves.toBe(false);
    expect(m.query).not.toHaveBeenCalled();
    expect(m.update).not.toHaveBeenCalled();
  });

  it('tra theo lô chỉ hỏi phiếu OJ, một truy vấn', async () => {
    const m = { query: jest.fn().mockResolvedValue([{ id: 'c1' }]) };
    const set = await findOjInvoicedCaseIds(m as any, [
      { id: 'c1', classification: 'OJ' },
      { id: 'c2', classification: 'OJ_NGOAI' },
      { id: 'c3', classification: 'SUA_CHUA_CHUNG' },
    ]);
    expect(m.query).toHaveBeenCalledTimes(1);
    expect(m.query.mock.calls[0][1]).toEqual([['c1', 'c2']]);
    expect([...set]).toEqual(['c1']);
  });

  it('không có phiếu OJ thì không truy vấn', async () => {
    const m = { query: jest.fn() };
    const set = await findOjInvoicedCaseIds(m as any, [
      { id: 'c3', classification: null },
    ]);
    expect(set.size).toBe(0);
    expect(m.query).not.toHaveBeenCalled();
  });

  it('ojHasInvoice: true/false cho OJ, null cho phiếu khác', () => {
    const set = new Set(['c1', 'c3']);
    expect(ojHasInvoiceOf({ id: 'c1', classification: 'OJ' }, set)).toBe(true);
    expect(ojHasInvoiceOf({ id: 'c2', classification: 'OJ' }, set)).toBe(false);
    expect(
      ojHasInvoiceOf({ id: 'c3', classification: 'KHAC' }, set),
    ).toBeNull();
  });

  it('attachOjHasInvoice gắn cờ ngay trên danh sách phiếu', async () => {
    const m = { query: jest.fn().mockResolvedValue([{ id: 'c1' }]) };
    const cases = [
      { id: 'c1', classification: 'OJ' },
      { id: 'c2', classification: 'OJ' },
      { id: 'c3', classification: 'KHAC' },
    ];
    await attachOjHasInvoice(m as any, cases);
    expect(cases).toEqual([
      expect.objectContaining({ id: 'c1', ojHasInvoice: true }),
      expect.objectContaining({ id: 'c2', ojHasInvoice: false }),
      expect.objectContaining({ id: 'c3', ojHasInvoice: null }),
    ]);
  });
});
