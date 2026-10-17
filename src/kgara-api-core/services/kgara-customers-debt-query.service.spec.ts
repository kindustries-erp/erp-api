import { KgaraCustomersDebtQueryService } from './kgara-customers-debt-query.service';

describe('KgaraCustomersDebtQueryService - agingBucket filter', () => {
  let service: KgaraCustomersDebtQueryService;
  let query: jest.Mock;

  beforeEach(() => {
    query = jest.fn().mockResolvedValue([{}]);
    const caseRepo = { manager: { query } } as any;
    service = new KgaraCustomersDebtQueryService(caseRepo);
  });

  const filtersWith = (values: string[]) =>
    JSON.stringify({ agingBucket: values });

  it('giữ xe có số dư trong mốc 31-60 (HAVING SUM(bucket) > 0)', async () => {
    await service.getCustomersDebt('', {
      filtersStr: filtersWith(['31-60']),
    });

    const [summarySql, summaryParams] = query.mock.calls[0];
    expect(summarySql).toContain('HAVING');
    expect(summarySql).toContain(
      'BETWEEN 31 AND 60 THEN "case"."tien_con_phai_thanh_toan" ELSE 0 END), 0) > 0',
    );
    expect(summaryParams).not.toContain('31-60');
  });

  it('nhiều mốc được nối bằng OR', async () => {
    await service.getCustomersDebt('', {
      filtersStr: filtersWith(['0-30', '>90']),
    });

    const [summarySql] = query.mock.calls[0];
    expect(summarySql).toMatch(/<= 30 THEN .* > 0\) OR \(COALESCE\(SUM/);
    expect(summarySql).toContain('> 90 THEN');
  });

  it('bỏ qua giá trị bucket không hợp lệ', async () => {
    await service.getCustomersDebt('', {
      filtersStr: filtersWith(['abc']),
    });

    const [summarySql] = query.mock.calls[0];
    expect(summarySql).not.toContain('HAVING');
  });

  it('không đổi hành vi maxAgingDays (vẫn dùng MAX tuổi phiếu)', async () => {
    await service.getCustomersDebt('', {
      filtersStr: JSON.stringify({ maxAgingDays: ['31-60 ngày'] }),
    });

    const [summarySql] = query.mock.calls[0];
    expect(summarySql).toContain('COALESCE(MAX(CASE WHEN');
    expect(summarySql).toContain('BETWEEN 31 AND 60');
  });
});
