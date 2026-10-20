import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { migrationChronologicalKey } from './migration-order';

/** Tên class migration (TypeORM dùng tên class, không dùng tên file). */
const migrationClassNames = (): string[] => {
  const dir = join(__dirname, '..', 'migrations');
  return readdirSync(dir)
    .filter((file) => file.endsWith('.ts') && !file.endsWith('.spec.ts'))
    .flatMap((file) => {
      const source = readFileSync(join(dir, file), 'utf8');
      const match = /export class (\w+)/.exec(source);
      return match ? [match[1]] : [];
    });
};

/**
 * Cặp (trước, sau) đã xác minh bằng SQL: migration sau cần đối tượng do migration trước tạo.
 * Nếu TypeORM đảo thứ tự, migration sau lỗi "relation does not exist" (xem plan 2026-10-18).
 */
const DEPENDENCY_PAIRS: Array<[string, string]> = [
  // AutoSync 1791505856412 sửa erp_einvoice_syncs do 20261006233500 tạo
  [
    'CreateEInvoiceSyncsAndExtendInvoices20261006233500',
    'CreateKgaraCashflowVoucher1791505856412',
  ],
  // bảng kgara_cashflow_vouchers do 1791505856412 tạo, 20261013083000 thêm cột
  [
    'CreateKgaraCashflowVoucher1791505856412',
    'AddPaymentContentToKgaraCashflowVouchers20261013083000',
  ],
  // cột kgara_cases do 1789500000000 thêm, 20261014130000 đọc
  [
    'AddModuleConfigAndExclusionsToKgaraCases1789500000000',
    'RemoveGarageCaseExcludeFlagsFromEav20261014130000',
  ],
];

describe('migration order over src/migrations', () => {
  const names = migrationClassNames();

  it('finds migration classes', () => {
    expect(names.length).toBeGreaterThan(100);
  });

  it('gives every migration a finite chronological key', () => {
    const bad = names.filter(
      (name) => !Number.isFinite(migrationChronologicalKey(name)),
    );
    expect(bad).toEqual([]);
  });

  it('has unique migration class names', () => {
    const duplicates = names.filter(
      (name, index) => names.indexOf(name) !== index,
    );
    expect(duplicates).toEqual([]);
  });

  it.each(DEPENDENCY_PAIRS)('runs %s before %s', (earlier, later) => {
    expect(names).toContain(earlier);
    expect(names).toContain(later);
    expect(migrationChronologicalKey(earlier)).toBeLessThan(
      migrationChronologicalKey(later),
    );
  });
});
