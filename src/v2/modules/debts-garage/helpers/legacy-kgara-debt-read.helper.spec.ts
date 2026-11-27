import {
  createSqlCapture,
  SqlCapture,
} from '@/common/testing/sql-capture.testing';
import {
  buildLegacyCustomerDebtQuery,
  buildLegacySupplierDebtQuery,
} from './legacy-kgara-debt-read.helper';

/** Logic đọc `kgara_*` cũ (deprecated 2026-11-28) vẫn được test để quay về an toàn khi cần. */
describe('legacy-kgara-debt-read.helper (deprecated)', () => {
  let cap: SqlCapture;

  beforeEach(async () => {
    cap = await createSqlCapture();
  });

  async function run(
    build: typeof buildLegacyCustomerDebtQuery,
    to?: string,
  ): Promise<{ sql: string; params: unknown[] }> {
    await build(cap.dataSource, {
      branchId: 'b1',
      from: '2026-09-01',
      to,
    }).getRawMany();
    return cap.calls[0];
  }

  it('phải thu: đọc kgara_cases, bỏ phiếu xóa/loại khỏi công nợ, gom biển số đã trim, to lấy hết ngày', async () => {
    const { sql, params } = await run(
      buildLegacyCustomerDebtQuery,
      '2026-09-30',
    );
    expect(sql).toContain('kgara_cases');
    expect(sql).not.toContain('debts_garage');
    expect(sql).toContain('c.kgara_deleted_at IS NULL');
    expect(sql).toContain('c.exclude_from_debt IS NOT TRUE');
    expect(sql).toContain("COALESCE(TRIM(c.bien_so_xe), '')");
    expect(sql).toContain('con_phai_thu');
    expect(params).toEqual(
      expect.arrayContaining(['b1', '2026-09-01', '2026-09-30 23:59:59.999']),
    );
  });

  it('phải trả: đọc kgara_cases + lãi gộp + PAYMENT, chỉ vụ chi phí > 0, giữ tên cột response', async () => {
    const { sql, params } = await run(buildLegacySupplierDebtQuery);
    expect(sql).toContain('kgara_gross_profit');
    expect(sql).toContain("s.settlement_type = 'PAYMENT'");
    expect(sql).toMatch(/> 0\)/);
    for (const alias of [
      'license_plate',
      'cost_amount',
      'paid_amount',
      'balance_amount',
      'aging_over_90',
    ]) {
      expect(sql).toContain(alias);
    }
    expect(params).toEqual(expect.arrayContaining(['b1', '2026-09-01']));
  });
});
