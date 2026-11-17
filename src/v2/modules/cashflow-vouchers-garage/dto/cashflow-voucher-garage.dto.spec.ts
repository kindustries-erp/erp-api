import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import {
  CreateCashflowVoucherGarageDto,
  UpdateCashflowVoucherGarageDto,
} from './create-cashflow-voucher-garage.dto';

const errs = (cls: any, plain: object) =>
  validateSync(plainToInstance(cls, plain), {
    whitelist: true,
    forbidNonWhitelisted: true,
  }).map((e) => e.property);

const ok = {
  voucherType: 'RECEIPT',
  amount: '500000',
  transDate: '2026-11-17',
};

describe('CreateCashflowVoucherGarageDto', () => {
  it('hợp lệ khi đủ trường bắt buộc, ép số tiền từ chuỗi', () => {
    expect(errs(CreateCashflowVoucherGarageDto, ok)).toEqual([]);
    expect(plainToInstance(CreateCashflowVoucherGarageDto, ok).amount).toBe(
      500000,
    );
  });

  it('từ chối số tiền không dương, loại phiếu lạ, ngày sai, payer lạ, caseId không phải UUID', () => {
    for (const bad of [
      { amount: 0 },
      { amount: -5 },
      { voucherType: 'REFUND' },
      { transDate: '17/11/2026' },
      { payerType: 'XX' },
      { caseId: 'abc' },
      { status: 'DONE' },
    ]) {
      expect(
        errs(CreateCashflowVoucherGarageDto, { ...ok, ...bad }).length,
      ).toBeGreaterThan(0);
    }
  });

  it('không nhận trường nội bộ từ client (branch, source, createdBy)', () => {
    expect(
      errs(CreateCashflowVoucherGarageDto, {
        ...ok,
        branchExternalId: 'x',
        source: 'LEGACY',
        createdBy: 'u',
      }),
    ).toEqual(
      expect.arrayContaining(['branchExternalId', 'source', 'createdBy']),
    );
  });
});

describe('UpdateCashflowVoucherGarageDto', () => {
  it('mọi trường tùy chọn, không cho đổi loại phiếu, mã hay trạng thái', () => {
    expect(errs(UpdateCashflowVoucherGarageDto, {})).toEqual([]);
    expect(
      errs(UpdateCashflowVoucherGarageDto, { amount: 10, note: 'a' }),
    ).toEqual([]);
    expect(
      errs(UpdateCashflowVoucherGarageDto, {
        voucherType: 'PAYMENT',
        voucherCode: 'X',
        status: 'PAID',
      }),
    ).toEqual(expect.arrayContaining(['voucherType', 'voucherCode', 'status']));
  });
});
