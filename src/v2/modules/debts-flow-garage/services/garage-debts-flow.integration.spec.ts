import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { CashflowVoucherGarageCommandService } from '../../cashflow-vouchers-garage/services/cashflow-voucher-garage-command.service';
import { GarageDebtSettlementService } from '../../debts-garage/services/garage-debt-settlement.service';
import { LegacyKgaraMirrorService } from '../legacy/legacy-kgara-mirror.service';
import {
  createInMemoryLedger,
  MISSING_BRANCH_ID,
} from '../testing/in-memory-ledger.testing';
import { GarageDebtAllocationFlowService } from './garage-debt-allocation-flow.service';
import { GarageDebtsFlowService } from './garage-debts-flow.service';
import { GarageVoucherAllocationService } from './garage-voucher-allocation.service';

/** Luồng thật (settlement, command, allocation, flow) trên DB giả có snapshot/rollback. */
function setup() {
  const db = createInMemoryLedger();
  const events = { publish: jest.fn().mockResolvedValue(undefined) };
  const settlement = new GarageDebtSettlementService();
  const projector = {
    projectCase: jest.fn().mockResolvedValue({ upserted: 0, voided: 0 }),
  };
  const alloc = new GarageVoucherAllocationService(
    settlement,
    projector as never,
  );
  const vouchers = new CashflowVoucherGarageCommandService({
    next: async () => `PT-${Date.now()}-${Math.random()}`,
  } as never);
  const hub = { handleCashflowSettled: jest.fn().mockResolvedValue({}) };
  const mirror = new LegacyKgaraMirrorService(hub as never);
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
  db.seedCase();
  return { db, events, flow, manual, settlement, projector, hub };
}

const receipt = (over: object = {}) => ({
  voucherType: 'RECEIPT' as const,
  amount: 300,
  transDate: '2026-11-17',
  caseId: 'case-1',
  ...over,
});

describe('luồng thu chi + công nợ garage (integration, DB giả)', () => {
  it('phiếu thu PAID gắn vụ việc: ghi phiếu và trừ nợ trong một transaction, phát sự kiện sau commit', async () => {
    const { db, flow, events, projector } = setup();
    const debt = db.seedDebt({});
    const out = await flow.recordVoucher('B1', receipt(), 'u1');
    expect(out).toMatchObject({
      status: 'PAID',
      amount: 300,
      createdBy: 'u1',
      licensePlate: '30A-1',
    });
    expect(projector.projectCase).toHaveBeenCalledWith(
      expect.anything(),
      'case-1',
    );
    expect(db.debts()[0]).toMatchObject({
      settledAmount: '300.00',
      balanceAmount: '700.00',
      id: debt.id,
    });
    expect(db.allocations()).toHaveLength(1);
    expect(events.publish).toHaveBeenCalledWith(
      expect.objectContaining({ payload: { caseIds: ['case-1'] } }),
    );
  });

  it('phiếu chi mặc định PENDING: chưa phân bổ cho tới khi xác nhận PAID', async () => {
    const { db, flow } = setup();
    db.seedDebt({
      direction: 'PAYABLE',
      partyType: 'SUPPLIER',
      originalAmount: 400,
    });
    const v = await flow.recordVoucher(
      'B1',
      receipt({ voucherType: 'PAYMENT', amount: 150 }),
      null,
    );
    expect(v.status).toBe('PENDING');
    expect(db.allocations()).toHaveLength(0);
    await flow.changeVoucherStatus('B1', v.id, 'PAID', null);
    expect(db.debts()[0]).toMatchObject({
      settledAmount: '150.00',
      balanceAmount: '250.00',
    });
  });

  it('thu của bảo hiểm vào dòng INSURER; vượt số dư thì tràn và thu dư', async () => {
    const { db, flow } = setup();
    db.seedDebt({ partyType: 'CUSTOMER', originalAmount: 700 });
    db.seedDebt({ partyType: 'INSURER', originalAmount: 300 });
    await flow.recordVoucher(
      'B1',
      receipt({ amount: 1200, payerType: 'BH' }),
      null,
    );
    const [cus, ins] = db.debts();
    expect(ins).toMatchObject({
      settledAmount: '500.00',
      balanceAmount: '0.00',
      status: 'SETTLED',
    });
    expect(cus).toMatchObject({
      settledAmount: '700.00',
      balanceAmount: '0.00',
    });
  });

  it('sửa số tiền: đảo phân bổ cũ rồi áp lại với khóa idempotent mới', async () => {
    const { db, flow } = setup();
    db.seedDebt({});
    const v = await flow.recordVoucher('B1', receipt(), null);
    await flow.updateVoucher('B1', v.id, { amount: 500 }, null);
    expect(db.debts()[0]).toMatchObject({
      settledAmount: '500.00',
      balanceAmount: '500.00',
    });
    const keys = db.allocations().map((a) => a.idempotencyKey);
    expect(new Set(keys).size).toBe(keys.length);
    expect(db.allocations().filter((a) => !a.reversedAt)).toHaveLength(1);
  });

  it('hủy phiếu hoàn nợ; hủy lần hai bị từ chối và không đổi gì', async () => {
    const { db, flow } = setup();
    db.seedDebt({});
    const v = await flow.recordVoucher('B1', receipt(), null);
    const cancelled = await flow.changeVoucherStatus(
      'B1',
      v.id,
      'CANCELLED',
      null,
    );
    expect(cancelled.status).toBe('CANCELLED');
    expect(db.debts()[0]).toMatchObject({
      settledAmount: '0.00',
      balanceAmount: '1000.00',
      status: 'OPEN',
    });
    await expect(
      flow.changeVoucherStatus('B1', v.id, 'CANCELLED', null),
    ).rejects.toThrow(BadRequestException);
    expect(db.allocations().filter((a) => !a.reversedAt)).toHaveLength(0);
  });

  it('một bước lỗi thì rollback cả phiếu lẫn phân bổ và không phát sự kiện', async () => {
    const { db, flow, events, settlement } = setup();
    db.seedDebt({ partyType: 'CUSTOMER', originalAmount: 100 });
    db.seedDebt({ partyType: 'INSURER', originalAmount: 100 });
    const real = settlement.apply.bind(settlement);
    let calls = 0;
    jest.spyOn(settlement, 'apply').mockImplementation((m, c) => {
      calls += 1;
      if (calls === 2) throw new Error('lỗi giữa chừng');
      return real(m, c);
    });
    await expect(
      flow.recordVoucher('B1', receipt({ amount: 150 }), null),
    ).rejects.toThrow('lỗi giữa chừng');
    expect(db.vouchers()).toHaveLength(0);
    expect(db.allocations()).toHaveLength(0);
    expect(db.debts().every((d) => d.settledAmount === '0.00')).toBe(true);
    expect(events.publish).not.toHaveBeenCalled();
  });

  it('vụ việc hoặc phiếu khác chi nhánh coi như không tồn tại', async () => {
    const { db, flow } = setup();
    db.seedDebt({});
    await expect(flow.recordVoucher('B2', receipt(), null)).rejects.toThrow(
      NotFoundException,
    );
    const v = await flow.recordVoucher('B1', receipt(), null);
    await expect(
      flow.changeVoucherStatus('B2', v.id, 'CANCELLED', null),
    ).rejects.toThrow(NotFoundException);
    await expect(
      flow.updateVoucher('B2', v.id, { amount: 1 }, null),
    ).rejects.toThrow(NotFoundException);
  });

  it('không chọn chi nhánh: phiếu lấy chi nhánh ERP và UUID KGara theo vụ việc, phân bổ theo khoản nợ', async () => {
    const { db, flow } = setup();
    db.seedDebt({});
    const v = await flow.recordVoucher(
      undefined,
      receipt({ status: 'PAID' }),
      null,
    );
    expect(db.vouchers()[0]).toMatchObject({
      id: v.id,
      branchId: 'B1',
      branchExternalId: 'KG1',
      licensePlate: '30A-1',
    });
    expect(db.allocations()[0]).toMatchObject({ branchId: 'B1' });
    // Không chọn chi nhánh thì đổi trạng thái được mọi phiếu.
    await flow.changeVoucherStatus(undefined, v.id, 'CANCELLED', null);
  });

  it('phiếu không gắn vụ việc: chi nhánh ERP đang chọn (hoặc null), không có UUID KGara', async () => {
    const { db, flow } = setup();
    await flow.recordVoucher('B9', receipt({ caseId: null }), null);
    await flow.recordVoucher(undefined, receipt({ caseId: null }), null);
    expect(db.vouchers().map((r) => [r.branchId, r.branchExternalId])).toEqual([
      ['B9', null],
      [null, null],
    ]);
  });

  it('phiếu không gắn vụ việc với chi nhánh không tồn tại → 400, không ghi phiếu', async () => {
    const { db, flow } = setup();
    await expect(
      flow.recordVoucher(MISSING_BRANCH_ID, receipt({ caseId: null }), null),
    ).rejects.toThrow(BadRequestException);
    expect(db.vouchers()).toHaveLength(0);
  });

  it('phân bổ thủ công: idempotent, từ chối vượt số dư, không làm số dư âm', async () => {
    const { db, manual } = setup();
    const debt = db.seedDebt({ originalAmount: 500 });
    const dto = { debtId: debt.id as string, amount: 400 };
    const first = await manual.allocate('B1', dto, 'k1', 'u1');
    const replay = await manual.allocate('B1', dto, 'k1', 'u1');
    expect(first.replayed).toBe(false);
    expect(replay.replayed).toBe(true);
    expect(db.allocations()).toHaveLength(1);
    await expect(manual.allocate('B1', dto, 'k2', 'u1')).rejects.toThrow(
      ConflictException,
    );
    expect(db.debts()[0]).toMatchObject({
      balanceAmount: '100.00',
      settledAmount: '400.00',
    });
  });

  it('phân bổ khoản nợ khác chi nhánh thì 404', async () => {
    const { db, manual } = setup();
    const debt = db.seedDebt({});
    await expect(
      manual.allocate(
        'B2',
        { debtId: debt.id as string, amount: 10 },
        'k',
        null,
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it('phân bổ từ phiếu: chỉ phiếu PAID, tổng không vượt số tiền phiếu', async () => {
    const { db, flow, manual } = setup();
    const d1 = db.seedDebt({ partyType: 'CUSTOMER', originalAmount: 900 });
    const pending = await flow.recordVoucher(
      'B1',
      receipt({ amount: 500, status: 'PENDING', caseId: undefined }),
      null,
    );
    await expect(
      manual.allocate(
        'B1',
        { debtId: d1.id as string, amount: 100, voucherId: pending.id },
        'a',
        null,
      ),
    ).rejects.toThrow(ConflictException);
    await flow.changeVoucherStatus('B1', pending.id, 'PAID', null);
    await manual.allocate(
      'B1',
      { debtId: d1.id as string, amount: 400, voucherId: pending.id },
      'b',
      null,
    );
    await expect(
      manual.allocate(
        'B1',
        { debtId: d1.id as string, amount: 200, voucherId: pending.id },
        'c',
        null,
      ),
    ).rejects.toThrow(ConflictException);
  });

  it('đảo phân bổ trả lại số dư; đảo lại cùng khóa không đảo hai lần', async () => {
    const { db, manual } = setup();
    const debt = db.seedDebt({ originalAmount: 500 });
    const applied = await manual.allocate(
      'B1',
      { debtId: debt.id as string, amount: 400 },
      'k1',
      null,
    );
    await manual.reverseAllocation('B1', applied.allocation.id, 'r1', null);
    const again = await manual.reverseAllocation(
      'B1',
      applied.allocation.id,
      'r1',
      null,
    );
    expect(again.replayed).toBe(true);
    expect(db.debts()[0]).toMatchObject({
      settledAmount: '0.00',
      balanceAmount: '500.00',
    });
    await expect(
      manual.reverseAllocation('B2', applied.allocation.id, 'r9', null),
    ).rejects.toThrow(NotFoundException);
  });

  it('quy tắc V1: phiếu thu PENDING vẫn trừ nợ, dự thu EXPECTED thì không', async () => {
    const { db, flow } = setup();
    db.seedDebt({});
    await flow.recordVoucher('B1', receipt({ status: 'EXPECTED' }), null);
    expect(db.allocations()).toHaveLength(0);
    const v = await flow.recordVoucher(
      'B1',
      receipt({ status: 'PENDING', amount: 100 }),
      null,
    );
    expect(db.debts()[0]).toMatchObject({ settledAmount: '100.00' });
    await flow.changeVoucherStatus('B1', v.id, 'CANCELLED', null);
    expect(db.debts()[0]).toMatchObject({ settledAmount: '0.00' });
  });

  it('quy tắc V1: phiếu chi nhóm hoa hồng / chi phí trực tiếp không trừ công nợ phải trả', async () => {
    const { db, flow } = setup();
    db.seedDebt({
      direction: 'PAYABLE',
      partyType: 'SUPPLIER',
      originalAmount: 400,
    });
    await flow.recordVoucher(
      'B1',
      receipt({
        voucherType: 'PAYMENT',
        amount: 100,
        status: 'PAID',
        paymentContent: '4. HHBH',
      }),
      null,
    );
    expect(db.allocations()).toHaveLength(0);
    await flow.recordVoucher(
      'B1',
      receipt({
        voucherType: 'PAYMENT',
        amount: 100,
        status: 'PAID',
        paymentContent: 'Phụ tùng',
      }),
      null,
    );
    expect(db.debts()[0]).toMatchObject({ settledAmount: '100.00' });
  });

  it('phiếu thu không nêu bên trả: còn nợ bảo hiểm thì BH trước, không thì KH', async () => {
    const { db, flow } = setup();
    db.seedDebt({ partyType: 'CUSTOMER', originalAmount: 700 });
    db.seedDebt({ partyType: 'INSURER', originalAmount: 300 });
    const first = await flow.recordVoucher(
      'B1',
      receipt({ amount: 300 }),
      null,
    );
    expect(first.payerType).toBe('BH');
    expect(db.debts()[1]).toMatchObject({
      balanceAmount: '0.00',
      status: 'SETTLED',
    });
    const second = await flow.recordVoucher(
      'B1',
      receipt({ amount: 200 }),
      null,
    );
    expect(second.payerType).toBe('KH');
    expect(db.debts()[0]).toMatchObject({ settledAmount: '200.00' });
  });
});
