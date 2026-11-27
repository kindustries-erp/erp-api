import { createSqlCapture } from '@/common/testing/sql-capture.testing';
import { CustomerDebtQueryService } from '../services/customer-debt-query.service';
import { SupplierDebtQueryService } from '../services/supplier-debt-query.service';

/** Không còn cờ: phải thu và phải trả luôn đọc sổ nợ, kể cả khi env cũ vẫn đặt DEBTS_GARAGE_LEDGER_READ. */
describe('ledger-read.helper (đọc sổ nợ mặc định)', () => {
  const OLD = process.env.DEBTS_GARAGE_LEDGER_READ;
  afterEach(() => {
    if (OLD === undefined) delete process.env.DEBTS_GARAGE_LEDGER_READ;
    else process.env.DEBTS_GARAGE_LEDGER_READ = OLD;
  });

  it.each(['false', undefined])(
    'env cũ DEBTS_GARAGE_LEDGER_READ=%s không còn tác dụng: vẫn đọc debts_garage',
    async (value) => {
      if (value === undefined) delete process.env.DEBTS_GARAGE_LEDGER_READ;
      else process.env.DEBTS_GARAGE_LEDGER_READ = value;
      const cap = await createSqlCapture();
      await new CustomerDebtQueryService(cap.dataSource).findPage({
        branchId: 'b1',
      });
      await new SupplierDebtQueryService(cap.dataSource).findPage({
        branchId: 'b1',
      });
      expect(cap.calls.length).toBeGreaterThan(0);
      for (const { sql } of cap.calls) {
        expect(sql).toContain('FROM "debts_garage" "d"');
        expect(sql).not.toContain('FROM "kgara_cases"');
      }
    },
  );

  it('phải thu: đọc sổ nợ RECEIVABLE, lọc chi nhánh, bỏ VOID/excluded, kẹp mốc theo dõi', async () => {
    const cap = await createSqlCapture();
    await new CustomerDebtQueryService(cap.dataSource).findPage({
      branchId: 'b1',
      from: '2020-01-01',
      to: '2026-09-30',
      scope: 'outstanding',
    });
    expect(cap.calls.length).toBeGreaterThan(0);
    for (const { sql, params } of cap.calls) {
      expect(sql).toContain('debts_garage');
      expect(sql).not.toContain('kgara_cases');
      expect(sql).toContain("d.status <> 'VOID'");
      expect(sql).toContain('d.excluded = false');
      expect(sql).toContain('g.con_phai_thu > 0');
      expect(params).toEqual(
        expect.arrayContaining([
          'RECEIVABLE',
          'b1',
          '2026-07-01',
          '2026-09-30',
        ]),
      );
      expect(params).not.toContain('2020-01-01');
    }
  });

  it('phải trả: đọc sổ nợ PAYABLE, giữ tên cột response', async () => {
    const cap = await createSqlCapture();
    await new SupplierDebtQueryService(cap.dataSource).findPage({
      branchId: 'b1',
      scope: 'outstanding',
    });
    const first = cap.calls[0];
    expect(first.sql).toContain('debts_garage');
    expect(first.sql).toContain('g.balance_amount > 0');
    expect(first.params).toEqual(expect.arrayContaining(['PAYABLE', 'b1']));
    for (const alias of [
      'license_plate',
      'cost_amount',
      'paid_amount',
      'aging_over_90',
    ]) {
      expect(first.sql).toContain(alias);
    }
  });
});
