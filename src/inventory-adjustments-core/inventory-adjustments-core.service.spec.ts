import { DataSource } from 'typeorm';
import { BadRequestException } from '@nestjs/common';
import { InventoryAdjustmentsCoreService } from './inventory-adjustments-core.service';
import { ErpInventoryAdjustment } from './entities/erp_inventory_adjustment.entity';
import { ErpInventoryAdjustmentLine } from './entities/erp_inventory_adjustment_line.entity';
import { ErpInventoryTransaction } from '../inventory-core/entities/erp_inventory_transaction.entity';
import { ErpInventoryBalance } from '../inventory-core/entities/erp_inventory_balance.entity';

describe('InventoryAdjustmentsCoreService — stock invariants', () => {
  function makeManager(repoMap: Map<any, any>) {
    return {
      getRepository: (entity: any) => repoMap.get(entity),
    };
  }

  function makeServiceWithManager(manager: any) {
    const dataSource = {
      transaction: jest.fn(async (cb: any) => cb(manager)),
    } as unknown as DataSource;

    const service = new InventoryAdjustmentsCoreService(
      dataSource,
      {} as any,
      {} as any,
    );

    // Mock findOne used in getAdjustmentOrThrow when called directly from postAdjustment/cancelAdjustment
    return { service, dataSource };
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  function makeAdj(overrides: Partial<any> = {}): any {
    return {
      id: 'adj1',
      adjustmentNo: 'DC-20260720-01',
      adjustmentDate: new Date('2026-07-20'),
      status: 'DRAFT',
      remarks: null,
      createdBy: 'u1',
      ...overrides,
    };
  }

  function makeLine(overrides: Partial<any> = {}): any {
    return {
      id: 'line1',
      adjustmentId: 'adj1',
      lineNo: 1,
      itemId: 'item1',
      qtyAdjusted: '5.000',
      typeAdjust: 'increase',
      unitCost: '10.000',
      ...overrides,
    };
  }

  function makeBalance(overrides: Partial<any> = {}): any {
    return {
      itemId: 'item1',
      warehouseCode: 'WH1',
      qtyOnHand: '10.000',
      qtyReserved: '0.000',
      inventoryValue: '100.000',
      avgUnitCost: '10.000',
      ...overrides,
    };
  }

  function makeRepos(adj: any, lines: any[], balance: any | null) {
    const adjRepo = {
      findOneBy: jest.fn().mockResolvedValue(adj),
      save: jest.fn(async (x: any) => x),
    };
    const lineRepo = {
      find: jest.fn().mockResolvedValue(lines),
    };
    const txnRepo = {
      create: jest.fn((x: any) => x),
      save: jest.fn(async (x: any) => x),
    };
    const balanceRepo = {
      findOne: jest.fn().mockResolvedValue(balance),
      find: jest.fn().mockResolvedValue(balance ? [balance] : []),
      save: jest.fn(async (x: any) => {
        const items = Array.isArray(x) ? x : [x];
        for (const item of items) {
          if (balance && item.itemId === balance.itemId) {
            Object.assign(balance, item);
          }
        }
        return x;
      }),
    };
    return { adjRepo, lineRepo, txnRepo, balanceRepo };
  }

  // ─── postAdjustment tests ─────────────────────────────────────────────────

  it('postAdjustment: increase — should increase qtyOnHand and write ADJUSTMENT transaction', async () => {
    const adj = makeAdj();
    const line = makeLine({ qtyAdjusted: '5.000', unitCost: '10.000' });
    const balance = makeBalance({
      qtyOnHand: '10.000',
      inventoryValue: '100.000',
    });

    const { adjRepo, lineRepo, txnRepo, balanceRepo } = makeRepos(
      adj,
      [line],
      balance,
    );
    const repoMap = new Map<any, any>([
      [ErpInventoryAdjustment, adjRepo],
      [ErpInventoryAdjustmentLine, lineRepo],
      [ErpInventoryTransaction, txnRepo],
      [ErpInventoryBalance, balanceRepo],
    ]);

    const { service } = makeServiceWithManager(makeManager(repoMap));
    await service.postAdjustment('adj1', { warehouseCode: 'WH1' });

    expect(Number(balance.qtyOnHand)).toBe(15);
    expect(Number(balance.inventoryValue)).toBe(150);
    expect(adj.status).toBe('POSTED');

    const txnCallArg = txnRepo.save.mock.calls[0][0];
    const txnCall = Array.isArray(txnCallArg) ? txnCallArg[0] : txnCallArg;
    expect(txnCall.transactionType).toBe('ADJUSTMENT');
    expect(txnCall.qtyIn).toBe('5.000');
    expect(txnCall.qtyOut).toBe('0.000');
    expect(txnCall.documentType).toBe('INVENTORY_ADJUSTMENT');
  });

  it('postAdjustment: decrease — should decrease qtyOnHand and write ADJUSTMENT transaction', async () => {
    const adj = makeAdj();
    const line = makeLine({
      qtyAdjusted: '-3.000',
      typeAdjust: 'decrease',
      unitCost: '10.000',
    });
    const balance = makeBalance({
      qtyOnHand: '10.000',
      inventoryValue: '100.000',
    });

    const { adjRepo, lineRepo, txnRepo, balanceRepo } = makeRepos(
      adj,
      [line],
      balance,
    );
    const repoMap = new Map<any, any>([
      [ErpInventoryAdjustment, adjRepo],
      [ErpInventoryAdjustmentLine, lineRepo],
      [ErpInventoryTransaction, txnRepo],
      [ErpInventoryBalance, balanceRepo],
    ]);

    const { service } = makeServiceWithManager(makeManager(repoMap));
    await service.postAdjustment('adj1', { warehouseCode: 'WH1' });

    expect(Number(balance.qtyOnHand)).toBe(7);
    expect(adj.status).toBe('POSTED');

    const txnCallArg = txnRepo.save.mock.calls[0][0];
    const txnCall = Array.isArray(txnCallArg) ? txnCallArg[0] : txnCallArg;
    expect(txnCall.qtyOut).toBe('3.000');
    expect(txnCall.qtyIn).toBe('0.000');
  });

  it('postAdjustment: decrease with no existing balance — should throw BadRequestException', async () => {
    const adj = makeAdj();
    const line = makeLine({ qtyAdjusted: '-5.000', typeAdjust: 'decrease' });

    const { adjRepo, lineRepo, txnRepo, balanceRepo } = makeRepos(
      adj,
      [line],
      null,
    );
    const repoMap = new Map<any, any>([
      [ErpInventoryAdjustment, adjRepo],
      [ErpInventoryAdjustmentLine, lineRepo],
      [ErpInventoryTransaction, txnRepo],
      [ErpInventoryBalance, balanceRepo],
    ]);

    const { service } = makeServiceWithManager(makeManager(repoMap));
    await expect(
      service.postAdjustment('adj1', { warehouseCode: 'WH1' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('postAdjustment: already POSTED — should throw BadRequestException', async () => {
    const adj = makeAdj({ status: 'POSTED' });
    const line = makeLine();
    const balance = makeBalance();

    const { adjRepo, lineRepo, txnRepo, balanceRepo } = makeRepos(
      adj,
      [line],
      balance,
    );
    const repoMap = new Map<any, any>([
      [ErpInventoryAdjustment, adjRepo],
      [ErpInventoryAdjustmentLine, lineRepo],
      [ErpInventoryTransaction, txnRepo],
      [ErpInventoryBalance, balanceRepo],
    ]);

    const { service } = makeServiceWithManager(makeManager(repoMap));
    await expect(
      service.postAdjustment('adj1', { warehouseCode: 'WH1' }),
    ).rejects.toThrow('Phiếu điều chỉnh đã được ghi nhận trước đó');
  });

  it('postAdjustment: no lines — should throw BadRequestException', async () => {
    const adj = makeAdj();
    const balance = makeBalance();

    const { adjRepo, lineRepo, txnRepo, balanceRepo } = makeRepos(
      adj,
      [],
      balance,
    );
    const repoMap = new Map<any, any>([
      [ErpInventoryAdjustment, adjRepo],
      [ErpInventoryAdjustmentLine, lineRepo],
      [ErpInventoryTransaction, txnRepo],
      [ErpInventoryBalance, balanceRepo],
    ]);

    const { service } = makeServiceWithManager(makeManager(repoMap));
    await expect(
      service.postAdjustment('adj1', { warehouseCode: 'WH1' }),
    ).rejects.toThrow('Phiếu điều chỉnh trống');
  });

  // ─── cancelAdjustment tests ───────────────────────────────────────────────

  it('cancelAdjustment: should revert qtyOnHand and write ADJUSTMENT_CANCEL transaction', async () => {
    const adj = makeAdj({ status: 'POSTED' });
    // Line increased +5 previously
    const line = makeLine({ qtyAdjusted: '5.000', unitCost: '10.000' });
    // Balance is currently at 15 (after +5 was posted)
    const balance = makeBalance({
      qtyOnHand: '15.000',
      inventoryValue: '150.000',
    });

    const { adjRepo, lineRepo, txnRepo, balanceRepo } = makeRepos(
      adj,
      [line],
      balance,
    );
    const repoMap = new Map<any, any>([
      [ErpInventoryAdjustment, adjRepo],
      [ErpInventoryAdjustmentLine, lineRepo],
      [ErpInventoryTransaction, txnRepo],
      [ErpInventoryBalance, balanceRepo],
    ]);

    const { service } = makeServiceWithManager(makeManager(repoMap));
    await service.cancelAdjustment('adj1');

    // 15 - 5 = 10 (reverted)
    expect(Number(balance.qtyOnHand)).toBe(10);
    expect(adj.status).toBe('CANCELLED');

    const txnCallArg = txnRepo.save.mock.calls[0][0];
    const txnCall = Array.isArray(txnCallArg) ? txnCallArg[0] : txnCallArg;
    expect(txnCall.transactionType).toBe('ADJUSTMENT_CANCEL');
    // Reverting an increase means qtyOut
    expect(txnCall.qtyOut).toBe('5.000');
    expect(txnCall.qtyIn).toBe('0.000');
  });

  it('cancelAdjustment: DRAFT status — should throw BadRequestException', async () => {
    const adj = makeAdj({ status: 'DRAFT' });
    const line = makeLine();
    const balance = makeBalance();

    const { adjRepo, lineRepo, txnRepo, balanceRepo } = makeRepos(
      adj,
      [line],
      balance,
    );
    const repoMap = new Map<any, any>([
      [ErpInventoryAdjustment, adjRepo],
      [ErpInventoryAdjustmentLine, lineRepo],
      [ErpInventoryTransaction, txnRepo],
      [ErpInventoryBalance, balanceRepo],
    ]);

    const { service } = makeServiceWithManager(makeManager(repoMap));
    await expect(service.cancelAdjustment('adj1')).rejects.toThrow(
      'Chỉ có thể hủy phiếu điều chỉnh đã ghi sổ (POSTED)',
    );
  });

  it('cancelAdjustment: already CANCELLED — should throw BadRequestException', async () => {
    const adj = makeAdj({ status: 'CANCELLED' });
    const line = makeLine();
    const balance = makeBalance();

    const { adjRepo, lineRepo, txnRepo, balanceRepo } = makeRepos(
      adj,
      [line],
      balance,
    );
    const repoMap = new Map<any, any>([
      [ErpInventoryAdjustment, adjRepo],
      [ErpInventoryAdjustmentLine, lineRepo],
      [ErpInventoryTransaction, txnRepo],
      [ErpInventoryBalance, balanceRepo],
    ]);

    const { service } = makeServiceWithManager(makeManager(repoMap));
    await expect(service.cancelAdjustment('adj1')).rejects.toThrow(
      'Phiếu điều chỉnh đã bị hủy trước đó',
    );
  });

  // ─── generateDailyAdjustmentNo tests ─────────────────────────────────────

  it('generateDailyAdjustmentNo: first voucher of the day — should return DC-YYYYMMDD-01', async () => {
    const qb = {
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(null),
    };
    const adjRepo = {
      createQueryBuilder: jest.fn().mockReturnValue(qb),
      save: jest.fn(async (x: any) => x),
      findOneBy: jest.fn().mockResolvedValue(null),
    };

    const manager = { getRepository: () => adjRepo };
    const dataSource = {
      transaction: jest.fn(async (cb: any) => cb(manager)),
    } as unknown as DataSource;

    const service = new InventoryAdjustmentsCoreService(
      dataSource,
      {} as any,
      {} as any,
    );
    const { nextNo } = await service.getNextAdjustmentNo('2026-07-20');

    expect(nextNo).toBe('DC-20260720-01');
  });

  it('generateDailyAdjustmentNo: existing voucher DC-20260720-03 — should return DC-20260720-04', async () => {
    const qb = {
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue({ adjustmentNo: 'DC-20260720-03' }),
    };
    const adjRepo = {
      createQueryBuilder: jest.fn().mockReturnValue(qb),
      save: jest.fn(async (x: any) => x),
      findOneBy: jest.fn().mockResolvedValue(null),
    };

    const manager = { getRepository: () => adjRepo };
    const dataSource = {
      transaction: jest.fn(async (cb: any) => cb(manager)),
    } as unknown as DataSource;

    const service = new InventoryAdjustmentsCoreService(
      dataSource,
      {} as any,
      {} as any,
    );
    const { nextNo } = await service.getNextAdjustmentNo('2026-07-20');

    expect(nextNo).toBe('DC-20260720-04');
  });
});
