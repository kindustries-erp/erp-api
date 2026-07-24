import { describe, expect, it, jest } from '@jest/globals';
import { DataSource } from 'typeorm';
import { GoodsReceiptsCoreService } from '../../goods-receipts-core/goods-receipts-core.service';
import { GoodsIssuesCoreService } from '../../goods-issues-core/goods-issues-core.service';
import { InventoryAdjustmentsCoreService } from '../../inventory-adjustments-core/inventory-adjustments-core.service';
import { ErpGoodsReceipt } from '../../goods-receipts-core/entities/erp_goods_receipt.entity';
import { ErpGoodsReceiptLine } from '../../goods-receipts-core/entities/erp_goods_receipt_line.entity';
import { ErpGoodsIssue } from '../../goods-issues-core/entities/erp_goods_issue.entity';
import { ErpGoodsIssueLine } from '../../goods-issues-core/entities/erp_goods_issue_line.entity';
import { ErpInventoryAdjustment } from '../../inventory-adjustments-core/entities/erp_inventory_adjustment.entity';
import { ErpInventoryAdjustmentLine } from '../../inventory-adjustments-core/entities/erp_inventory_adjustment_line.entity';
import { ErpInventoryTransaction } from '../entities/erp_inventory_transaction.entity';
import { ErpInventoryBalance } from '../entities/erp_inventory_balance.entity';
import { ErpPurchaseOrder } from '../../purchase-orders-core/entities/erp_purchase_order.entity';
import { ErpPurchaseOrderLine } from '../../purchase-orders-core/entities/erp_purchase_order_line.entity';
import { ErpProductionOrder } from '../../production-core/entities/erp_production_order.entity';
import { ErpProductionOrderMaterial } from '../../production-core/entities/erp_production_order_material.entity';
import { ErpSalesOrder } from '../../sales-orders-core/entities/erp_sales_order.entity';
import { ErpSalesOrderLine } from '../../sales-orders-core/entities/erp_sales_order_line.entity';
import { ErpInventoryTrackingSerial } from '../entities/erp_inventory_tracking_serial.entity';
import { ErpVehicle } from '../../erp-mfg-core/entities/erp_vehicle.entity';
import { ErpInventoryItem } from '../entities/erp_inventory_item.entity';
import { ErpSerialLifecycle } from '../entities/erp_serial_lifecycle.entity';

describe('Inventory voucher posting chain integration', () => {
  function makeManager(repoMap: Map<any, any>) {
    return {
      getRepository: (entity: any) => repoMap.get(entity),
    };
  }

  function makeDataSource(manager: any) {
    return {
      transaction: jest.fn(async (cb: any) => cb(manager)),
    } as unknown as DataSource;
  }

  function setupFixture() {
    const receipt = {
      id: 'gr-flow-1',
      receiptNo: 'NK-202607001',
      receiptDate: new Date('2026-07-20'),
      status: 'DRAFT',
      purchaseOrderId: null,
      productionOrderId: null,
      remarks: null,
      createdBy: 'u1',
      isDeleted: false,
    } as any;
    const receiptLine = {
      id: 'grl-flow-1',
      goodsReceiptId: 'gr-flow-1',
      lineNo: 1,
      itemId: 'item-1',
      qtyReceived: '10.000',
      unitCost: '100.000',
      purchaseOrderLineId: null,
    } as any;

    const issue = {
      id: 'gi-flow-1',
      issueNo: 'XK-202607001',
      issueDate: new Date('2026-07-20'),
      status: 'DRAFT',
      salesOrderId: null,
      productionOrderId: null,
      remarks: null,
      createdBy: 'u1',
      isDeleted: false,
    } as any;
    const issueLine = {
      id: 'gil-flow-1',
      goodsIssueId: 'gi-flow-1',
      lineNo: 1,
      itemId: 'item-1',
      qtyIssued: '3.000',
      unitCost: '100.000',
      salesOrderLineId: null,
      productionOrderMaterialId: null,
      serialId: null,
      vehicleId: null,
    } as any;

    const adjustment = {
      id: 'ia-flow-1',
      adjustmentNo: 'DC-20260720-01',
      adjustmentDate: new Date('2026-07-20'),
      status: 'DRAFT',
      remarks: null,
      createdBy: 'u1',
      isDeleted: false,
    } as any;
    const adjustmentLine = {
      id: 'ial-flow-1',
      adjustmentId: 'ia-flow-1',
      lineNo: 1,
      itemId: 'item-1',
      qtyAdjusted: '5.000',
      typeAdjust: 'increase',
      unitCost: '120.000',
    } as any;

    const balances: any[] = [
      {
        itemId: 'item-1',
        warehouseCode: 'WH1',
        qtyOnHand: '0.000',
        qtyReserved: '0.000',
        inventoryValue: '0.000',
        avgUnitCost: '0.000',
      },
    ];
    const transactions: any[] = [];

    const balanceRepo = {
      findOne: jest.fn(async ({ where }: any) => {
        return (
          balances.find((b) => {
            const matchItem = where?.itemId ? b.itemId === where.itemId : true;
            const matchWh = where?.warehouseCode
              ? b.warehouseCode === where.warehouseCode
              : true;
            return matchItem && matchWh;
          }) ?? null
        );
      }),
      find: jest.fn(async () => {
        return balances;
      }),
      save: jest.fn(async (x: any) => {
        const items = Array.isArray(x) ? x : [x];
        for (const item of items) {
          if (!item.itemId) continue;
          const idx = balances.findIndex(
            (b) =>
              b.itemId === item.itemId &&
              String(b.warehouseCode || '') ===
                String(item.warehouseCode || ''),
          );
          if (idx >= 0) {
            balances[idx] = { ...balances[idx], ...item };
          } else {
            balances.push(item);
          }
        }
        return x;
      }),
    };

    const txnRepo = {
      create: jest.fn((x: any) => x),
      save: jest.fn(async (x: any) => {
        const items = Array.isArray(x) ? x : [x];
        transactions.push(...items);
        return x;
      }),
    };

    const receiptRepo = {
      findOneBy: jest.fn(async ({ id, isDeleted }: any) => {
        if (id === receipt.id && isDeleted === false) return receipt;
        return null;
      }),
      save: jest.fn(async (x: any) => x),
    };
    const receiptLineRepo = {
      find: jest.fn(async ({ where }: any) =>
        where?.goodsReceiptId === receipt.id ? [receiptLine] : [],
      ),
    };

    const issueRepo = {
      findOneBy: jest.fn(async ({ id, isDeleted }: any) => {
        if (id === issue.id && isDeleted === false) return issue;
        return null;
      }),
      save: jest.fn(async (x: any) => x),
    };
    const issueLineRepo = {
      find: jest.fn(async ({ where }: any) =>
        where?.goodsIssueId === issue.id ? [issueLine] : [],
      ),
      save: jest.fn(async (x: any) => x),
    };

    const adjustmentRepo = {
      findOneBy: jest.fn(async ({ id, isDeleted }: any) => {
        if (id === adjustment.id && isDeleted === false) return adjustment;
        return null;
      }),
      save: jest.fn(async (x: any) => x),
    };
    const adjustmentLineRepo = {
      find: jest.fn(async ({ where }: any) =>
        where?.adjustmentId === adjustment.id ? [adjustmentLine] : [],
      ),
    };

    const itemRepo = {
      findOne: jest.fn().mockImplementation(async () => ({
        id: 'item-1',
        itemType: { code: 'FG' },
      })),
    };

    const dependencyService = { checkDependencies: jest.fn() };

    const repoMap = new Map<any, any>([
      [ErpGoodsReceipt, receiptRepo],
      [ErpGoodsReceiptLine, receiptLineRepo],
      [ErpGoodsIssue, issueRepo],
      [ErpGoodsIssueLine, issueLineRepo],
      [ErpInventoryAdjustment, adjustmentRepo],
      [ErpInventoryAdjustmentLine, adjustmentLineRepo],
      [ErpInventoryTransaction, txnRepo],
      [ErpInventoryBalance, balanceRepo],
      [ErpPurchaseOrder, { findOneBy: jest.fn(), save: jest.fn() }],
      [
        ErpPurchaseOrderLine,
        { findOneBy: jest.fn(), find: jest.fn(), save: jest.fn() },
      ],
      [ErpProductionOrder, { findOneBy: jest.fn(), save: jest.fn() }],
      [
        ErpProductionOrderMaterial,
        { find: jest.fn(), findOneBy: jest.fn(), save: jest.fn() },
      ],
      [ErpSalesOrder, { findOneBy: jest.fn(), save: jest.fn() }],
      [
        ErpSalesOrderLine,
        { findOneBy: jest.fn(), find: jest.fn(), save: jest.fn() },
      ],
      [ErpInventoryTrackingSerial, { findOneBy: jest.fn(), save: jest.fn() }],
      [ErpVehicle, { findOneBy: jest.fn(), save: jest.fn() }],
      [ErpInventoryItem, itemRepo],
    ]);

    const manager = makeManager(repoMap);
    const dataSource = makeDataSource(manager);

    const grService = new GoodsReceiptsCoreService(
      dataSource,
      {} as any,
      {} as any,
      dependencyService as any,
      {} as any,
    );
    const giService = new GoodsIssuesCoreService(
      dataSource,
      {} as any,
      {} as any,
      {} as any,
    );
    jest.spyOn(giService, 'findOne').mockResolvedValue({ ok: true } as any);
    const iaService = new InventoryAdjustmentsCoreService(
      dataSource,
      {} as any,
      {} as any,
    );

    return {
      receipt,
      issue,
      adjustment,
      balances,
      transactions,
      dependencyService,
      grService,
      giService,
      iaService,
    };
  }

  function setupSoSerialFixture() {
    const issue = {
      id: 'gi-so-1',
      issueNo: 'XK-202607009',
      issueDate: new Date('2026-07-21'),
      status: 'DRAFT',
      salesOrderId: 'so-1',
      productionOrderId: null,
      customerId: 'dealer-1',
      remarks: null,
      createdBy: 'u1',
      isDeleted: false,
    } as any;

    const issueLine = {
      id: 'gil-so-1',
      goodsIssueId: 'gi-so-1',
      lineNo: 1,
      itemId: 'item-1',
      qtyIssued: '1.000',
      unitCost: '100.000',
      salesOrderLineId: 'sol-1',
      productionOrderMaterialId: null,
      serialId: 'ser-1',
      vehicleId: 'veh-1',
    } as any;

    const so = {
      id: 'so-1',
      status: 'CONFIRMED',
    } as any;

    const soLine = {
      id: 'sol-1',
      salesOrderId: 'so-1',
      qtyOrdered: '3.000',
      qtyReserved: '2.000',
      qtyDelivered: '0.000',
    } as any;

    const serial = {
      id: 'ser-1',
      itemId: 'item-1',
      vinId: 'veh-1',
      status: 'AVAILABLE',
      goodsIssueLineId: null,
      salesOrderLineId: null,
    } as any;

    const vehicle = {
      id: 'veh-1',
      finishedGoodItemId: 'item-1',
      status: 'AVAILABLE',
    } as any;

    const balances: any[] = [
      {
        itemId: 'item-1',
        warehouseCode: 'WH1',
        qtyOnHand: '5.000',
        qtyReserved: '2.000',
        inventoryValue: '500.000',
        avgUnitCost: '100.000',
      },
    ];
    const transactions: any[] = [];
    const lifecycles: any[] = [];

    const balanceRepo = {
      findOne: jest.fn(async ({ where }: any) => {
        return (
          balances.find((b) => {
            const matchItem = where?.itemId ? b.itemId === where.itemId : true;
            const matchWh = where?.warehouseCode
              ? b.warehouseCode === where.warehouseCode
              : true;
            return matchItem && matchWh;
          }) ?? null
        );
      }),
      save: jest.fn(async (x: any) => {
        const idx = balances.findIndex(
          (b) =>
            b.itemId === x.itemId &&
            String(b.warehouseCode || '') === String(x.warehouseCode || ''),
        );
        if (idx >= 0) {
          balances[idx] = { ...balances[idx], ...x };
          return balances[idx];
        }
        balances.push(x);
        return x;
      }),
    };

    const txnRepo = {
      create: jest.fn((x: any) => x),
      save: jest.fn(async (x: any) => {
        transactions.push(x);
        return x;
      }),
    };

    const issueRepo = {
      findOneBy: jest.fn(async ({ id, isDeleted }: any) => {
        if (id === issue.id && isDeleted === false) return issue;
        return null;
      }),
      save: jest.fn(async (x: any) => x),
    };

    const issueLineRepo = {
      find: jest.fn(async ({ where }: any) =>
        where?.goodsIssueId === issue.id ? [issueLine] : [],
      ),
      save: jest.fn(async (x: any) => x),
    };

    const soRepo = {
      findOneBy: jest.fn(async ({ id }: any) => (id === so.id ? so : null)),
      save: jest.fn(async (x: any) => x),
    };

    const soLineRepo = {
      findOneBy: jest.fn(async ({ id }: any) =>
        id === soLine.id ? soLine : null,
      ),
      find: jest.fn(async ({ where }: any) =>
        where?.salesOrderId === so.id ? [soLine] : [],
      ),
      save: jest.fn(async (x: any) => x),
    };

    const serialRepo = {
      findOneBy: jest.fn(async (where: any) => {
        if (where?.id && where.id === serial.id) return serial;
        if (where?.vinId && where.vinId === serial.vinId) return serial;
        return null;
      }),
      save: jest.fn(async (x: any) => x),
    };

    const vehicleRepo = {
      findOneBy: jest.fn(async ({ id }: any) =>
        id === vehicle.id ? vehicle : null,
      ),
      save: jest.fn(async (x: any) => x),
    };

    const lifecycleRepo = {
      findOneBy: jest.fn(
        async ({ serialId }: any) =>
          lifecycles.find((l) => l.serialId === serialId) ?? null,
      ),
      create: jest.fn((x: any) => x),
      save: jest.fn(async (x: any) => {
        const idx = lifecycles.findIndex((l) => l.serialId === x.serialId);
        if (idx >= 0) {
          lifecycles[idx] = { ...lifecycles[idx], ...x };
          return lifecycles[idx];
        }
        lifecycles.push(x);
        return x;
      }),
    };

    const itemRepo = {
      findOne: jest.fn().mockImplementation(async () => ({
        id: 'item-1',
        itemType: { code: 'FG' },
      })),
    };

    const repoMap = new Map<any, any>([
      [ErpGoodsIssue, issueRepo],
      [ErpGoodsIssueLine, issueLineRepo],
      [ErpInventoryTransaction, txnRepo],
      [ErpInventoryBalance, balanceRepo],
      [ErpSalesOrder, soRepo],
      [ErpSalesOrderLine, soLineRepo],
      [ErpProductionOrder, { findOneBy: jest.fn(), save: jest.fn() }],
      [
        ErpProductionOrderMaterial,
        { findOneBy: jest.fn(), find: jest.fn(), save: jest.fn() },
      ],
      [ErpInventoryTrackingSerial, serialRepo],
      [ErpVehicle, vehicleRepo],
      [ErpInventoryItem, itemRepo],
      [ErpSerialLifecycle, lifecycleRepo],
    ]);

    const manager = makeManager(repoMap);
    const dataSource = makeDataSource(manager);

    const giService = new GoodsIssuesCoreService(
      dataSource,
      {} as any,
      {} as any,
      {} as any,
    );
    jest.spyOn(giService, 'findOne').mockResolvedValue({ ok: true } as any);

    return {
      issue,
      issueLine,
      so,
      soLine,
      serial,
      vehicle,
      balances,
      transactions,
      lifecycles,
      giService,
    };
  }

  function setupMoFixture() {
    const issue = {
      id: 'gi-mo-1',
      issueNo: 'XK-202607010',
      issueDate: new Date('2026-07-22'),
      status: 'DRAFT',
      salesOrderId: null,
      productionOrderId: 'mo-1',
      remarks: null,
      createdBy: 'u1',
      isDeleted: false,
    } as any;

    const issueLine = {
      id: 'gil-mo-1',
      goodsIssueId: 'gi-mo-1',
      lineNo: 1,
      itemId: 'item-rm-1',
      qtyIssued: '2.000',
      unitCost: '50.000',
      salesOrderLineId: null,
      productionOrderMaterialId: 'momat-1',
      serialId: null,
      vehicleId: null,
    } as any;

    const mo = {
      id: 'mo-1',
      status: 'CONFIRMED',
      qtyToProduce: '10.000',
      qtyProduced: '0.000',
    } as any;

    const moMat = {
      id: 'momat-1',
      productionOrderId: 'mo-1',
      qtyRequired: '4.000',
      qtyIssued: '0.000',
    } as any;

    const balances: any[] = [
      {
        itemId: 'item-rm-1',
        warehouseCode: 'WH1',
        qtyOnHand: '5.000',
        qtyReserved: '2.000',
        inventoryValue: '250.000',
        avgUnitCost: '50.000',
      },
    ];
    const transactions: any[] = [];

    const balanceRepo = {
      findOne: jest.fn(async ({ where }: any) => {
        return (
          balances.find((b) => {
            const matchItem = where?.itemId ? b.itemId === where.itemId : true;
            const matchWh = where?.warehouseCode
              ? b.warehouseCode === where.warehouseCode
              : true;
            return matchItem && matchWh;
          }) ?? null
        );
      }),
      save: jest.fn(async (x: any) => {
        const idx = balances.findIndex(
          (b) =>
            b.itemId === x.itemId &&
            String(b.warehouseCode || '') === String(x.warehouseCode || ''),
        );
        if (idx >= 0) {
          balances[idx] = { ...balances[idx], ...x };
          return balances[idx];
        }
        balances.push(x);
        return x;
      }),
    };

    const txnRepo = {
      create: jest.fn((x: any) => x),
      save: jest.fn(async (x: any) => {
        transactions.push(x);
        return x;
      }),
    };

    const issueRepo = {
      findOneBy: jest.fn(async ({ id, isDeleted }: any) => {
        if (id === issue.id && isDeleted === false) return issue;
        return null;
      }),
      save: jest.fn(async (x: any) => x),
    };

    const issueLineRepo = {
      find: jest.fn(async ({ where }: any) =>
        where?.goodsIssueId === issue.id ? [issueLine] : [],
      ),
      save: jest.fn(async (x: any) => x),
    };

    const moRepo = {
      findOneBy: jest.fn(async ({ id }: any) => (id === mo.id ? mo : null)),
      save: jest.fn(async (x: any) => x),
    };

    const moMatRepo = {
      findOneBy: jest.fn(async ({ id }: any) =>
        id === moMat.id ? moMat : null,
      ),
      find: jest.fn(async ({ where }: any) =>
        where?.productionOrderId === mo.id ? [moMat] : [],
      ),
      save: jest.fn(async (x: any) => x),
    };

    const itemRepo = {
      findOne: jest.fn().mockImplementation(async () => ({
        id: 'item-rm-1',
        itemType: { code: 'FG' },
      })),
    };

    const repoMap = new Map<any, any>([
      [ErpGoodsIssue, issueRepo],
      [ErpGoodsIssueLine, issueLineRepo],
      [ErpInventoryTransaction, txnRepo],
      [ErpInventoryBalance, balanceRepo],
      [ErpSalesOrder, { findOneBy: jest.fn(), save: jest.fn() }],
      [
        ErpSalesOrderLine,
        { findOneBy: jest.fn(), find: jest.fn(), save: jest.fn() },
      ],
      [ErpProductionOrder, moRepo],
      [ErpProductionOrderMaterial, moMatRepo],
      [ErpInventoryTrackingSerial, { findOneBy: jest.fn(), save: jest.fn() }],
      [ErpVehicle, { findOneBy: jest.fn(), save: jest.fn() }],
      [ErpInventoryItem, itemRepo],
      [
        ErpSerialLifecycle,
        { findOneBy: jest.fn(), create: jest.fn(), save: jest.fn() },
      ],
    ]);

    const manager = makeManager(repoMap);
    const dataSource = makeDataSource(manager);

    const giService = new GoodsIssuesCoreService(
      dataSource,
      {} as any,
      {} as any,
      {} as any,
    );
    jest.spyOn(giService, 'findOne').mockResolvedValue({ ok: true } as any);

    return {
      issue,
      issueLine,
      mo,
      moMat,
      balances,
      transactions,
      giService,
    };
  }

  it('should preserve qty/value invariants across GR -> GI -> IA posting chain', async () => {
    const fx = setupFixture();

    await fx.grService.postReceipt(fx.receipt.id, { warehouseCode: 'WH1' });
    await fx.giService.postIssue(fx.issue.id, { warehouseCode: 'WH1' });
    await fx.iaService.postAdjustment(fx.adjustment.id, {
      warehouseCode: 'WH1',
    });

    expect(fx.receipt.status).toBe('POSTED');
    expect(fx.issue.status).toBe('POSTED');
    expect(fx.adjustment.status).toBe('POSTED');

    const finalBalance = fx.balances[0];
    expect(finalBalance.qtyOnHand).toBe('12.000');
    expect(finalBalance.inventoryValue).toBe('1300.000');
    expect(finalBalance.avgUnitCost).toBe('108.333');

    expect(fx.transactions).toHaveLength(3);
    expect(fx.transactions[0].transactionType).toBe('RECEIPT');
    expect(fx.transactions[1].transactionType).toBe('ISSUE');
    expect(fx.transactions[2].transactionType).toBe('ADJUSTMENT');

    expect(fx.transactions[0].qtyIn).toBe('10.000');
    expect(fx.transactions[1].qtyOut).toBe('3.000');
    expect(fx.transactions[2].qtyIn).toBe('5.000');
  });

  it('should restore qty/value to baseline across IA cancel -> GI cancel -> GR cancel', async () => {
    const fx = setupFixture();

    await fx.grService.postReceipt(fx.receipt.id, { warehouseCode: 'WH1' });
    await fx.giService.postIssue(fx.issue.id, { warehouseCode: 'WH1' });
    await fx.iaService.postAdjustment(fx.adjustment.id, {
      warehouseCode: 'WH1',
    });

    await fx.iaService.cancelAdjustment(fx.adjustment.id);
    await fx.giService.cancelIssue(fx.issue.id);
    await fx.grService.cancelReceipt(fx.receipt.id);

    expect(fx.adjustment.status).toBe('CANCELLED');
    expect(fx.issue.status).toBe('CANCELLED');
    expect(fx.receipt.status).toBe('CANCELLED');

    const finalBalance = fx.balances[0];
    expect(finalBalance.qtyOnHand).toBe('0.000');
    expect(finalBalance.inventoryValue).toBe('0.000');
    expect(finalBalance.avgUnitCost).toBe('0.000');

    expect(fx.dependencyService.checkDependencies).toHaveBeenCalledWith(
      'goods_receipts',
      fx.receipt.id,
    );

    expect(fx.transactions).toHaveLength(6);
    expect(fx.transactions[3].transactionType).toBe('ADJUSTMENT_CANCEL');
    expect(fx.transactions[4].transactionType).toBe('ISSUE_CANCEL');
    expect(fx.transactions[5].transactionType).toBe('RECEIPT_CANCEL');

    expect(fx.transactions[3].qtyOut).toBe('5.000');
    expect(fx.transactions[4].qtyIn).toBe('3.000');
    expect(fx.transactions[5].qtyOut).toBe('10.000');
  });

  it('should update SO + serial on GI post and revert them on GI cancel', async () => {
    const fx = setupSoSerialFixture();

    await fx.giService.postIssue(fx.issue.id, { warehouseCode: 'WH1' });

    expect(fx.issue.status).toBe('POSTED');
    expect(fx.soLine.qtyDelivered).toBe('1.000');
    expect(fx.soLine.qtyReserved).toBe('1.000');
    expect(fx.so.status).toBe('PARTIAL_RESERVED');
    expect(fx.serial.status).toBe('DELIVERING');
    expect(fx.serial.goodsIssueLineId).toBe(fx.issueLine.id);
    expect(fx.serial.salesOrderLineId).toBe(fx.soLine.id);
    expect(fx.vehicle.status).toBe('DELIVERING');
    expect(fx.lifecycles).toHaveLength(1);
    expect(fx.lifecycles[0].serialId).toBe(fx.serial.id);
    expect(fx.lifecycles[0].goodsIssueId).toBe(fx.issue.id);

    const balanceAfterPost = fx.balances[0];
    expect(balanceAfterPost.qtyOnHand).toBe('4.000');
    expect(balanceAfterPost.qtyReserved).toBe('1.000');
    expect(balanceAfterPost.inventoryValue).toBe('400.000');

    await fx.giService.cancelIssue(fx.issue.id);

    expect(fx.issue.status).toBe('CANCELLED');
    expect(fx.soLine.qtyDelivered).toBe('0.000');
    expect(fx.so.status).toBe('DRAFT');
    expect(fx.serial.status).toBe('AVAILABLE');
    expect(fx.serial.goodsIssueLineId).toBeNull();
    expect(fx.vehicle.status).toBe('AVAILABLE');

    const balanceAfterCancel = fx.balances[0];
    expect(balanceAfterCancel.qtyOnHand).toBe('5.000');
    expect(balanceAfterCancel.qtyReserved).toBe('2.000');
    expect(balanceAfterCancel.inventoryValue).toBe('500.000');

    expect(fx.transactions).toHaveLength(2);
    expect(fx.transactions[0].transactionType).toBe('ISSUE');
    expect(fx.transactions[1].transactionType).toBe('ISSUE_CANCEL');
  });

  it('should update MO material on GI post and revert on GI cancel', async () => {
    const fx = setupMoFixture();

    await fx.giService.postIssue(fx.issue.id, { warehouseCode: 'WH1' });

    expect(fx.issue.status).toBe('POSTED');
    expect(fx.moMat.qtyIssued).toBe('2.000');
    expect(fx.mo.status).toBe('IN_PROGRESS');

    const balanceAfterPost = fx.balances[0];
    expect(balanceAfterPost.qtyOnHand).toBe('3.000');
    expect(balanceAfterPost.qtyReserved).toBe('0.000');
    expect(balanceAfterPost.inventoryValue).toBe('150.000');

    await fx.giService.cancelIssue(fx.issue.id);

    expect(fx.issue.status).toBe('CANCELLED');
    expect(fx.moMat.qtyIssued).toBe('0.000');
    expect(fx.mo.status).toBe('CONFIRMED');

    const balanceAfterCancel = fx.balances[0];
    expect(balanceAfterCancel.qtyOnHand).toBe('5.000');
    expect(balanceAfterCancel.qtyReserved).toBe('2.000');
    expect(balanceAfterCancel.inventoryValue).toBe('250.000');

    expect(fx.transactions).toHaveLength(2);
    expect(fx.transactions[0].transactionType).toBe('ISSUE');
    expect(fx.transactions[1].transactionType).toBe('ISSUE_CANCEL');
  });
});
