import { migrationChronologicalKey } from './migration-order';

describe('migrationChronologicalKey', () => {
  it('reads a 14-digit YYYYMMDDHHmmss suffix as the real UTC time', () => {
    expect(migrationChronologicalKey('AddX20261013083000')).toBe(
      Date.UTC(2026, 9, 13, 8, 30, 0),
    );
  });

  it('reads a 13-digit epoch-ms suffix as the epoch value itself', () => {
    expect(
      migrationChronologicalKey('CreateKgaraCashflowVoucher1791505856412'),
    ).toBe(1791505856412);
  });

  it('orders a 14-digit migration by its real date, not after every epoch migration', () => {
    // Đây là lỗi gốc: TypeORM đặt 2026-10-13 (14 số) trước 2026-10-09 (epoch) vì cắt sai.
    const epochCreate = migrationChronologicalKey(
      'CreateKgaraCashflowVoucher1791505856412',
    );
    const laterAlter = migrationChronologicalKey(
      'AddPaymentContentToKgaraCashflowVouchers20261013083000',
    );
    expect(epochCreate).toBeLessThan(laterAlter);
  });

  it('keeps the TypeORM rule for names that do not end in a timestamp', () => {
    expect(migrationChronologicalKey('AutoSync_1782086619')).toBe(
      parseInt('AutoSync_1782086619'.substr(-13), 10),
    );
  });

  it('falls back to the TypeORM rule when the 14 digits are not a real date', () => {
    // 20261399999999 không phải ngày hợp lệ (tháng 13), nên dùng giá trị số như TypeORM
    expect(migrationChronologicalKey('Bad20261399999999')).toBe(20261399999999);
  });

  it('treats a 13-digit run that is preceded by digits as the suffix only', () => {
    expect(migrationChronologicalKey('X1791505856412')).toBe(1791505856412);
  });
});
