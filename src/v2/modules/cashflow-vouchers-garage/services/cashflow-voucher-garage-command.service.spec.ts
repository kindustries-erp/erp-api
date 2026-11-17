import { AbstractCashflowVoucherCommandService } from '@/v2/core/cashflow-vouchers-core';
import { CashflowVoucherGarage } from '../entities/cashflow-voucher-garage.entity';
import { CashflowVoucherGarageCommandService } from './cashflow-voucher-garage-command.service';

describe('CashflowVoucherGarageCommandService', () => {
  it('kế thừa lệnh lõi, trỏ đúng bảng phiếu garage và dùng bộ sinh mã garage', () => {
    const codes = { next: jest.fn() };
    const svc = new CashflowVoucherGarageCommandService(codes as never);
    expect(svc).toBeInstanceOf(AbstractCashflowVoucherCommandService);
    const inner = svc as unknown as Record<string, unknown>;
    expect(inner.voucherTarget).toBe(CashflowVoucherGarage);
    expect(inner.codes).toBe(codes);
  });
});
