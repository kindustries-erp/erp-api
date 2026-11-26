import { GarageDebtSettlementService } from '../../debts-garage/services/garage-debt-settlement.service';
import { createInMemoryLedger } from '../testing/in-memory-ledger.testing';
import { LegacyAllocationSyncService } from './legacy-allocation-sync.service';
import { LegacyProjectorService } from './legacy-projector.service';

function setup() {
  const db = createInMemoryLedger();
  const ledger = { projectCase: jest.fn().mockResolvedValue({}) };
  const svc = new LegacyProjectorService(
    db.dataSource,
    new LegacyAllocationSyncService(
      ledger as never,
      new GarageDebtSettlementService(),
    ),
  );
  db.seedCase({});
  const customer = db.seedDebt({ partyType: 'CUSTOMER', originalAmount: 1000 });
  const insurer = db.seedDebt({
    partyType: 'INSURER',
    originalAmount: 500,
    partyCode: 'BH1',
  });
  const settle = (over: Record<string, unknown> = {}) => {
    db.v1Settlements().push({
      id: 's-1',
      caseId: 'case-1',
      settlementType: 'RECEIPT',
      payerType: 'KH',
      amount: 300,
      transDate: '2026-11-17',
      ...over,
    });
  };
  return { db, svc, ledger, customer, insurer, settle };
}

describe('LegacyProjectorService (V1 → sổ nợ v2)', () => {
  it('projectCase: settlement V1 thành phân bổ LEGACY, KH vào khoản khách, BH vào bảo hiểm', async () => {
    const { db, svc, ledger, customer, insurer, settle } = setup();
    settle();
    settle({ id: 's-2', payerType: 'BH', amount: 200 });
    await svc.projectCase('case-1');
    expect(ledger.projectCase).toHaveBeenCalled();
    expect(customer).toMatchObject({
      settledAmount: '300.00',
      balanceAmount: '700.00',
    });
    expect(insurer).toMatchObject({
      settledAmount: '200.00',
      balanceAmount: '300.00',
    });
    expect(db.allocations().every((a) => a.origin === 'LEGACY')).toBe(true);
  });

  it('chạy lại không nhân đôi (idempotent)', async () => {
    const { db, svc, customer, settle } = setup();
    settle();
    await svc.projectCase('case-1');
    await svc.projectCase('case-1');
    expect(db.allocations()).toHaveLength(1);
    expect(customer.settledAmount).toBe('300.00');
  });

  it('settlement đổi số tiền: đảo phân bổ cũ, áp số mới', async () => {
    const { db, svc, customer, settle } = setup();
    settle();
    await svc.projectCase('case-1');
    db.v1Settlements()[0].amount = 450;
    await svc.projectCase('case-1');
    expect(customer).toMatchObject({
      settledAmount: '450.00',
      balanceAmount: '550.00',
    });
  });

  it('settlement bị xóa ở V1: số dư hoàn lại', async () => {
    const { db, svc, customer, settle } = setup();
    settle();
    await svc.projectCase('case-1');
    db.v1Settlements().length = 0;
    await svc.projectCase('case-1');
    expect(customer).toMatchObject({
      settledAmount: '0.00',
      balanceAmount: '1000.00',
    });
  });

  it('không đụng phân bổ NATIVE: settlement trùng id phân bổ NATIVE bị bỏ qua', async () => {
    const { db, svc, customer, settle } = setup();
    db.allocations().push({
      id: 's-1',
      debtId: customer.id,
      origin: 'NATIVE',
      amount: '300.00',
      idempotencyKey: 'k',
      reversedAt: null,
      reversalOfId: null,
    });
    settle();
    await svc.projectCase('case-1');
    expect(db.allocations()).toHaveLength(1);
    expect(customer.settledAmount).toBe('0.00');
  });

  it('removeVoucher: phiếu v2 thành CANCELLED và dựng lại vụ việc', async () => {
    const { db, svc, ledger } = setup();
    db.vouchers().push({ id: 'v-1', status: 'PAID', caseId: 'case-1' });
    await svc.removeVoucher('v-1', 'case-1');
    expect(db.vouchers()[0].status).toBe('CANCELLED');
    expect(ledger.projectCase).toHaveBeenCalled();
  });

  it('projectVoucher: dựng phiếu v2 từ V1 (chi nhánh theo vụ việc, source LEGACY, bên trả theo settlement)', async () => {
    const { db, svc, settle } = setup();
    db.v1Vouchers().push({
      id: 'v-9',
      voucherCode: 'PT-9',
      voucherType: 'RECEIPT',
      paymentStatus: 'PAID',
      transDate: '2026-11-17',
      amount: 300,
      caseId: 'case-1',
    });
    settle({ id: 's-9', cashflowVoucherId: 'v-9', payerType: 'BH' });
    await svc.projectVoucher('v-9');
    expect(db.vouchers()[0]).toMatchObject({
      id: 'v-9',
      branchExternalId: 'KG1',
      branchId: 'B1',
      source: 'LEGACY',
      status: 'PAID',
      payerType: 'BH',
      amount: '300.00',
    });
    expect(db.allocations()[0]).toMatchObject({
      voucherId: 'v-9',
      origin: 'LEGACY',
    });
  });

  it('phiếu không vụ việc và không có chi nhánh mặc định thì báo lỗi, không ghi gì', async () => {
    const { db, svc } = setup();
    delete process.env.GARAGE_DEFAULT_BRANCH_EXTERNAL_ID;
    db.v1Vouchers().push({
      id: 'v-8',
      voucherCode: 'PT-8',
      voucherType: 'RECEIPT',
      transDate: '2026-11-17',
      amount: 1,
    });
    await expect(svc.projectVoucher('v-8')).rejects.toThrow('chi nhánh');
    expect(db.vouchers()).toHaveLength(0);
  });
});
