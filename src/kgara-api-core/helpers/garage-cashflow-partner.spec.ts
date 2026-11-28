import {
  applyPartnerNameFilter,
  defaultGaragePartnerName,
  GARAGE_PARTNER_NAME_SQL,
} from './garage-cashflow-partner';

describe('garage-cashflow-partner', () => {
  it('chỉ phiếu thu lấy tên khách làm đối tác mặc định', () => {
    expect(defaultGaragePartnerName('RECEIPT', 'Khách A')).toBe('Khách A');
    expect(defaultGaragePartnerName('PAYMENT', 'Khách A')).toBeUndefined();
    expect(defaultGaragePartnerName('RECEIPT', null)).toBeUndefined();
  });

  const filter = (values: string[]) => {
    const qb = { andWhere: jest.fn() };
    applyPartnerNameFilter(qb as any, values, 'p');
    return qb.andWhere;
  };

  it('lọc theo đúng biểu thức hiển thị, không khớp riêng tên khách', () => {
    expect(filter(['Khách A'])).toHaveBeenCalledWith(
      `(${GARAGE_PARTNER_NAME_SQL} IN (:...p))`,
      { p: ['Khách A'] },
    );
  });

  it('gộp lựa chọn trống bằng OR', () => {
    const andWhere = filter(['Khách A', '__BLANK__']);
    expect(andWhere.mock.calls[0][0]).toContain('IN (:...p) OR ');
    expect(andWhere.mock.calls[0][0]).toContain('IS NULL');
  });

  it('chỉ chọn trống thì không truyền tham số; không chọn gì thì không lọc', () => {
    expect(filter(['__BLANK__']).mock.calls[0][1]).toBeUndefined();
    expect(filter([])).not.toHaveBeenCalled();
  });
});
