import { CashflowVoucherGarageCommandService } from '../../cashflow-vouchers-garage/services/cashflow-voucher-garage-command.service';
import { GarageDebtSettlementService } from '../../debts-garage/services/garage-debt-settlement.service';
import { GarageDebtAllocationFlowService } from '../services/garage-debt-allocation-flow.service';
import { GarageDebtsFlowService } from '../services/garage-debts-flow.service';
import { GarageVoucherAllocationService } from '../services/garage-voucher-allocation.service';
import { createInMemoryLedger } from '../testing/in-memory-ledger.testing';
import { LegacyKgaraMirrorService } from './legacy-kgara-mirror.service';
import { toLegacyPaymentMethod } from './legacy-voucher.mapper';

function setup() {
  const db = createInMemoryLedger();
  const hub = { handleCashflowSettled: jest.fn().mockResolvedValue({}) };
  const mirror = new LegacyKgaraMirrorService(hub as never);
  const settlement = new GarageDebtSettlementService();
  const projector = { projectCase: jest.fn().mockResolvedValue({}) };
  const events = { publish: jest.fn().mockResolvedValue(undefined) };
  const vouchers = new CashflowVoucherGarageCommandService({
    next: async () => `PT-${Math.random()}`,
  } as never);
  const alloc = new GarageVoucherAllocationService(
    settlement,
    projector as never,
  );
  const flow = new GarageDebtsFlowService(
    db.dataSource,
    events as never,
    vouchers,
    alloc,
    mirror,
  );
  const manual = new GarageDebtAllocationFlowService(
    db.dataSource,
    events as never,
    vouchers,
    settlement,
    mirror,
  );
  db.seedCase({
    tienCoThue: 1000,
    tienDaThanhToan: 0,
    tienConPhaiThanhToan: 1000,
    rawData: {},
  });
  db.seedDebt({});
  return { db, hub, flow, manual };
}

const receipt = (over: object = {}) => ({
  voucherType: 'RECEIPT' as const,
  amount: 300,
  transDate: '2026-11-17',
  caseId: 'case-1',
  paymentMethod: 'Chuyển khoản',
  ...over,
});

describe('LegacyKgaraMirrorService (v2 → bảng V1, cùng transaction)', () => {
  it('phiếu thu: phiếu V1 cùng UUID, settlement RECEIPT, còn phải thu của vụ việc, gọi hub V1', async () => {
    const { db, hub, flow } = setup();
    const out = await flow.recordVoucher('B1', receipt(), 'u1');
    expect(db.v1Vouchers()[0]).toMatchObject({
      id: out.id,
      voucherCode: out.voucherCode,
      paymentStatus: 'PAID',
      amount: 300,
      caseId: 'case-1',
    });
    expect(db.v1Settlements()).toHaveLength(1);
    expect(db.v1Settlements()[0]).toMatchObject({
      cashflowVoucherId: out.id,
      settlementType: 'RECEIPT',
      amount: 300,
      paymentMethod: 'BANK_TRANSFER',
      sourceChannel: 'ON_SYSTEM',
      payerType: 'KH',
    });
    expect(db.cases()[0]).toMatchObject({
      tienDaThanhToan: 300,
      tienConPhaiThanhToan: 700,
    });
    expect(hub.handleCashflowSettled).toHaveBeenCalledWith(
      expect.objectContaining({
        voucher: expect.objectContaining({ id: out.id }),
        user: { sub: 'u1' },
      }),
      expect.anything(),
    );
  });

  it('dự thu EXPECTED: có phiếu V1 nhưng không có settlement, vụ việc không đổi', async () => {
    const { db, flow } = setup();
    await flow.recordVoucher('B1', receipt({ status: 'EXPECTED' }), null);
    expect(db.v1Vouchers()).toHaveLength(1);
    expect(db.v1Settlements()).toHaveLength(0);
    expect(db.cases()[0]).toMatchObject({
      tienDaThanhToan: 0,
      tienConPhaiThanhToan: 1000,
    });
  });

  it('sửa số tiền cập nhật settlement hiện có (không nhân đôi); đổi vụ việc tính lại cả vụ cũ', async () => {
    const { db, flow } = setup();
    db.cases().push({
      id: 'case-2',
      branchExternalId: 'B1',
      tienCoThue: 500,
      rawData: {},
    });
    const v = await flow.recordVoucher('B1', receipt(), null);
    await flow.updateVoucher('B1', v.id, { amount: 450 }, null);
    expect(db.v1Settlements()).toHaveLength(1);
    expect(db.v1Settlements()[0].amount).toBe(450);
    expect(db.cases()[0]).toMatchObject({
      tienDaThanhToan: 450,
      tienConPhaiThanhToan: 550,
    });
    await flow.updateVoucher('B1', v.id, { caseId: 'case-2' }, null);
    expect(db.cases()[0]).toMatchObject({
      tienDaThanhToan: 0,
      tienConPhaiThanhToan: 1000,
    });
    expect(db.cases()[1]).toMatchObject({
      tienDaThanhToan: 450,
      tienConPhaiThanhToan: 50,
    });
  });

  it('hủy phiếu: V1 thấy CANCELLED, settlement gỡ, vụ việc hoàn lại', async () => {
    const { db, flow } = setup();
    const v = await flow.recordVoucher('B1', receipt(), null);
    await flow.changeVoucherStatus('B1', v.id, 'CANCELLED', null);
    expect(db.v1Vouchers()[0].paymentStatus).toBe('CANCELLED');
    expect(db.v1Settlements()).toHaveLength(0);
    expect(db.cases()[0]).toMatchObject({
      tienDaThanhToan: 0,
      tienConPhaiThanhToan: 1000,
    });
  });

  it('phiếu chi nhóm opex: V1 có phiếu và gọi hub (ghi opex), không có settlement', async () => {
    const { db, hub, flow } = setup();
    await flow.recordVoucher(
      'B1',
      receipt({
        voucherType: 'PAYMENT',
        status: 'PAID',
        paymentContent: '4. HHBH',
      }),
      null,
    );
    expect(db.v1Settlements()).toHaveLength(0);
    expect(hub.handleCashflowSettled).toHaveBeenCalledTimes(1);
  });

  it('phân bổ thủ công: settlement V1 cùng UUID kênh ngoài hệ thống; đảo thì gỡ và tính lại', async () => {
    const { db, flow: _flow, manual } = setup();
    const debt = db.debts()[0];
    const out = await manual.allocate(
      'B1',
      { debtId: debt.id, amount: 250 },
      'k1',
      null,
    );
    expect(db.v1Settlements()[0]).toMatchObject({
      id: out.allocation.id,
      settlementType: 'RECEIPT',
      sourceChannel: 'OFF_SYSTEM_MANUAL',
      amount: 250,
    });
    expect(db.cases()[0]).toMatchObject({
      tienDaThanhToan: 250,
      tienConPhaiThanhToan: 750,
    });
    await manual.reverseAllocation('B1', out.allocation.id, 'r1', null);
    expect(db.v1Settlements()).toHaveLength(0);
    expect(db.cases()[0]).toMatchObject({
      tienDaThanhToan: 0,
      tienConPhaiThanhToan: 1000,
    });
  });

  it('lỗi ở bước mirror thì rollback cả phiếu v2', async () => {
    const { db, hub, flow } = setup();
    hub.handleCashflowSettled.mockRejectedValueOnce(new Error('hub lỗi'));
    await expect(flow.recordVoucher('B1', receipt(), null)).rejects.toThrow(
      'hub lỗi',
    );
    expect(db.vouchers()).toHaveLength(0);
    expect(db.v1Vouchers()).toHaveLength(0);
    expect(db.debts()[0]).toMatchObject({ settledAmount: '0.00' });
  });
});

describe('toLegacyPaymentMethod', () => {
  it('ánh xạ như V1', () => {
    expect(toLegacyPaymentMethod('Chuyển khoản')).toBe('BANK_TRANSFER');
    expect(toLegacyPaymentMethod('Tiền mặt')).toBe('CASH');
    expect(toLegacyPaymentMethod('Quẹt thẻ')).toBe('POS');
    expect(toLegacyPaymentMethod('Thẻ')).toBe('POS');
    expect(toLegacyPaymentMethod('Ví điện tử')).toBe('OTHER');
    expect(toLegacyPaymentMethod(undefined)).toBe('CASH');
  });
});
