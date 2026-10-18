import { DataSource, Migration, MigrationExecutor } from 'typeorm';
import { ChronologicalMigrationExecutor } from './chronological-migration-executor';

// DataSource thật nhưng chưa initialize: không mở kết nối, chỉ để constructor của executor chạy
const fakeDataSource = new DataSource({ type: 'postgres', database: 'unused' });

const migration = (name: string): Migration =>
  new Migration(
    undefined,
    parseInt(name.substr(-13), 10),
    name,
    undefined,
    true,
  );

const orderFrom = (names: string[]): string[] => {
  const spy = jest
    .spyOn(MigrationExecutor.prototype as any, 'getMigrations')
    .mockReturnValue(names.map(migration));
  try {
    const executor = new ChronologicalMigrationExecutor(fakeDataSource);
    return (executor as any).getMigrations().map((m: Migration) => m.name);
  } finally {
    spy.mockRestore();
  }
};

describe('ChronologicalMigrationExecutor', () => {
  afterEach(() => jest.restoreAllMocks());

  it('runs the epoch CreateKgaraCashflowVoucher before the 2026-10-13 ALTER that needs its table', () => {
    expect(
      orderFrom([
        'AddPaymentContentToKgaraCashflowVouchers20261013083000',
        'CreateKgaraCashflowVoucher1791505856412',
      ]),
    ).toEqual([
      'CreateKgaraCashflowVoucher1791505856412',
      'AddPaymentContentToKgaraCashflowVouchers20261013083000',
    ]);
  });

  it('runs a 2026-09 epoch migration before a 2026-10 14-digit one', () => {
    expect(
      orderFrom([
        'RouteGarageCashflowPaymentVouchers20261017101000',
        'AddModuleConfigAndExclusionsToKgaraCases1789500000000',
      ])[0],
    ).toBe('AddModuleConfigAndExclusionsToKgaraCases1789500000000');
  });

  it('does not mutate the list returned by TypeORM', () => {
    const input = [migration('B20261013083000'), migration('A20260101000000')];
    const spy = jest
      .spyOn(MigrationExecutor.prototype as any, 'getMigrations')
      .mockReturnValue(input);
    const executor = new ChronologicalMigrationExecutor(fakeDataSource);
    (executor as any).getMigrations();
    expect(input[0].name).toBe('B20261013083000');
    spy.mockRestore();
  });
});
