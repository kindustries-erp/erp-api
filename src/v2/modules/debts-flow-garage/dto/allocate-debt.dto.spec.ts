import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { AllocateDebtDto, ChangeVoucherStatusDto } from './allocate-debt.dto';

const errs = (cls: any, plain: object) =>
  validateSync(plainToInstance(cls, plain), {
    whitelist: true,
    forbidNonWhitelisted: true,
  }).map((e) => e.property);
const ID = '11111111-1111-4111-8111-111111111111';

describe('AllocateDebtDto', () => {
  it('hợp lệ với debtId UUID và số tiền dương (ép từ chuỗi)', () => {
    expect(errs(AllocateDebtDto, { debtId: ID, amount: '250.5' })).toEqual([]);
  });

  it('từ chối số tiền không dương, debtId sai, nguồn lạ (không cho CASHFLOW_VOUCHER), trường lạ', () => {
    for (const bad of [
      { amount: 0 },
      { amount: -1 },
      { debtId: 'x' },
      { sourceType: 'CASHFLOW_VOUCHER' },
      { payerType: 'XX' },
      { idempotencyKey: 'k' },
    ]) {
      expect(
        errs(AllocateDebtDto, { debtId: ID, amount: 10, ...bad }).length,
      ).toBeGreaterThan(0);
    }
  });
});

describe('ChangeVoucherStatusDto', () => {
  it('chỉ nhận APPROVED hoặc PAID (hủy qua route riêng)', () => {
    expect(errs(ChangeVoucherStatusDto, { status: 'PAID' })).toEqual([]);
    expect(errs(ChangeVoucherStatusDto, { status: 'CANCELLED' })).toEqual([
      'status',
    ]);
  });
});
