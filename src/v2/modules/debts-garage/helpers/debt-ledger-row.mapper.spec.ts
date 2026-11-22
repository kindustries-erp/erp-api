import type { DebtAllocationGarage } from '../entities/debt-allocation-garage.entity';
import type { DebtGarage } from '../entities/debt-garage.entity';
import { toDebtAllocationRow, toDebtLedgerRow } from './debt-ledger-row.mapper';

describe('debt-ledger-row.mapper', () => {
  it('đổi numeric chuỗi sang number, null hóa trường rỗng, không lộ trường lạ', () => {
    const row = toDebtLedgerRow({
      id: 'd1',
      branchExternalId: 'b1',
      sourceType: 'CASE',
      sourceId: 'c1',
      direction: 'RECEIVABLE',
      partyType: 'CUSTOMER',
      partyCode: 'KH1',
      originalAmount: '1000.00',
      settledAmount: '250.50',
      balanceAmount: '749.50',
      status: 'OPEN',
      excluded: false,
      origin: 'SYNC',
      version: 3,
      extraData: { secret: 1 },
    } as unknown as DebtGarage);
    expect(row).toMatchObject({
      originalAmount: 1000,
      settledAmount: 250.5,
      balanceAmount: 749.5,
      caseId: null,
      partnerId: null,
      partyName: null,
      dueBaseDate: null,
    });
    expect(row).not.toHaveProperty('extraData');
  });

  it('phân bổ: số tiền number, reversedAt dạng ISO', () => {
    const out = toDebtAllocationRow({
      id: 'a1',
      debtId: 'd1',
      sourceType: 'CASHFLOW_VOUCHER',
      amount: '300.00',
      payerType: 'KH',
      origin: 'NATIVE',
      reversedAt: new Date('2026-11-17T00:00:00Z'),
      createdAt: new Date('2026-11-16T00:00:00Z'),
    } as unknown as DebtAllocationGarage);
    expect(out).toMatchObject({
      amount: 300,
      reversedAt: '2026-11-17T00:00:00.000Z',
      sourceId: null,
      voucherId: null,
    });
  });
});
