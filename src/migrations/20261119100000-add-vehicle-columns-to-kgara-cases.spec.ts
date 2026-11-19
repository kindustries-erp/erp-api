import { QueryRunner } from 'typeorm';
import { AddVehicleColumnsToKgaraCases20261119100000 } from './20261119100000-add-vehicle-columns-to-kgara-cases';

describe('AddVehicleColumnsToKgaraCases20261119100000', () => {
  const make = () => {
    const query = jest.fn().mockResolvedValue(undefined);
    return { runner: { query } as unknown as QueryRunner, query };
  };
  const sqlOf = (query: jest.Mock) =>
    query.mock.calls.map((c) => c[0] as string).join('\n');

  it('up() thêm 5 cột idempotent, index và backfill từ raw_data', async () => {
    const { runner, query } = make();
    await new AddVehicleColumnsToKgaraCases20261119100000().up(runner);
    const sql = sqlOf(query);
    for (const col of [
      'hang_xe_code',
      'hang_xe_name',
      'dong_xe_code',
      'dong_xe_name',
      'nam_san_xuat',
    ]) {
      expect(sql).toContain(`ADD COLUMN IF NOT EXISTS "${col}"`);
    }
    expect(sql).toContain(
      'CREATE INDEX IF NOT EXISTS "IDX_kgara_cases_hang_xe_code"',
    );
    expect(sql).toContain(`'HoSoPhuongTien'`);
    expect(sql).toContain('COALESCE("hang_xe_code"');
  });

  it('down() gỡ index và 5 cột', async () => {
    const { runner, query } = make();
    await new AddVehicleColumnsToKgaraCases20261119100000().down(runner);
    const sql = sqlOf(query);
    expect(sql).toContain(
      'DROP INDEX IF EXISTS "IDX_kgara_cases_hang_xe_code"',
    );
    expect(sql.match(/DROP COLUMN IF EXISTS/g)).toHaveLength(5);
  });
});
