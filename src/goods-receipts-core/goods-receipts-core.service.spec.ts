import { describe, expect, it, jest } from '@jest/globals';
import { DataSource } from 'typeorm';
import { GoodsReceiptsCoreService } from './goods-receipts-core.service';
import { ErpGoodsReceipt } from './entities/erp_goods_receipt.entity';
import { ErpGoodsReceiptLine } from './entities/erp_goods_receipt_line.entity';
import { ErpInventoryTransaction } from '../inventory-core/entities/erp_inventory_transaction.entity';
import { ErpInventoryBalance } from '../inventory-core/entities/erp_inventory_balance.entity';
import { ErpPurchaseOrder } from '../purchase-orders-core/entities/erp_purchase_order.entity';
import { ErpPurchaseOrderLine } from '../purchase-orders-core/entities/erp_purchase_order_line.entity';
import { ErpProductionOrder } from '../production-core/entities/erp_production_order.entity';
import { ErpProductionOrderMaterial } from '../production-core/entities/erp_production_order_material.entity';

const j: any = jest;

describe('GoodsReceiptsCoreService stock and posting invariants', () => {
  function makeManager(repoMap: Map<any, any>) {
    return {
      getRepository: (entity: any) => repoMap.get(entity),
    };
  }

  function makeServiceWithManager(manager: any, dependencyService?: any) {
    const dataSource = {
      transaction: j.fn(async (cb: any) => cb(manager)),
    } as unknown as DataSource;

    const service = new GoodsReceiptsCoreService(
      dataSource,
      {} as any,
      {} as any,
      dependencyService ?? { checkDependencies: j.fn() },
      {} as any,
    );

    return { service };
  }

  it('postReceipt should increase onHand and inventoryValue, update PO line and PO status', async () => {
    const receipt = {
      id: 'gr1',
      receiptNo: 'NK-202607001',
      receiptDate: new Date('2026-07-20'),
      status: 'DRAFT',
      purchaseOrderId: 'po1',
      productionOrderId: null,
      remarks: null,
      createdBy: 'u1',
      isDeleted: false,
    } as any;

    const line = {
      id: 'grl1',
      goodsReceiptId: 'gr1',
      lineNo: 1,
      itemId: 'item1',
      qtyReceived: '5.000',
      unitCost: '100.000',
      purchaseOrderLineId: 'pol1',
    } as any;

    const balance = {
      itemId: 'item1',
      warehouseCode: 'WH1',
      qtyOnHand: '20.000',
      avgUnitCost: '100.000',
      inventoryValue: '2000.000',
    } as any;

    const poLine = {
      id: 'pol1',
      purchaseOrderId: 'po1',
      qtyOrdered: '10.000',
      qtyReceived: '3.000',
    } as any;

    const po = {
      id: 'po1',
      status: 'CONFIRMED',
    } as any;

    const receiptRepo = {
      findOneBy: j.fn().mockResolvedValue(receipt),
      save: j.fn(async (x: any) => x),
    };

    const lineRepo = {
      find: j.fn().mockResolvedValue([line]),
    };

    const txnRepo = {
      create: j.fn((x: any) => x),
      save: j.fn(async (x: any) => x),
      insert: j.fn(async (x: any) => x),
    };

    const balanceRepo = {
      findOne: j.fn().mockResolvedValue(balance),
      find: j.fn().mockResolvedValue([balance]),
      findBy: j.fn().mockResolvedValue([balance]),
      save: j.fn(async (x: any) => x),
    };

    const poRepo = {
      findOneBy: j.fn().mockResolvedValue(po),
      save: j.fn(async (x: any) => x),
    };

    const poLineRepo = {
      findOneBy: j.fn().mockResolvedValue(poLine),
      save: j.fn(async (x: any) => x),
      find: j.fn().mockResolvedValue([poLine]),
      findBy: j.fn().mockResolvedValue([poLine]),
    };

    const moRepo = {
      findOneBy: j.fn(),
      save: j.fn(),
    };

    const moMatRepo = {
      find: j.fn(),
    };

    const repoMap = new Map<any, any>([
      [ErpGoodsReceipt, receiptRepo],
      [ErpGoodsReceiptLine, lineRepo],
      [ErpInventoryTransaction, txnRepo],
      [ErpInventoryBalance, balanceRepo],
      [ErpPurchaseOrder, poRepo],
      [ErpPurchaseOrderLine, poLineRepo],
      [ErpProductionOrder, moRepo],
      [ErpProductionOrderMaterial, moMatRepo],
    ]);

    const manager = makeManager(repoMap);
    const { service } = makeServiceWithManager(manager);

    await service.postReceipt('gr1', { warehouseCode: 'WH1' });

    expect(receipt.status).toBe('POSTED');
    expect(balance.qtyOnHand).toBe('25.000');
    expect(balance.inventoryValue).toBe('2500.000');
    expect(balance.avgUnitCost).toBe('100.000');
    expect(poLine.qtyReceived).toBe('8.000');
    expect(po.status).toBe('PARTIAL_RECEIVED');

    const txnCall = txnRepo.insert.mock.calls[0][0][0];
    expect(txnCall.transactionType).toBe('RECEIPT');
    expect(txnCall.qtyIn).toBe('5.000');
    expect(txnCall.qtyOut).toBe('0.000');
    expect(txnCall.documentType).toBe('GOODS_RECEIPT');
  });

  it('postReceipt should throw when receipt is already POSTED', async () => {
    const receipt = {
      id: 'gr2',
      status: 'POSTED',
      isDeleted: false,
    } as any;

    const receiptRepo = {
      findOneBy: j.fn().mockResolvedValue(receipt),
      save: j.fn(),
    };

    const repoMap = new Map<any, any>([
      [ErpGoodsReceipt, receiptRepo],
      [ErpGoodsReceiptLine, { find: j.fn() }],
      [ErpInventoryTransaction, { create: j.fn(), save: j.fn() }],
      [ErpInventoryBalance, { findOne: j.fn(), save: j.fn() }],
      [ErpPurchaseOrder, { findOneBy: j.fn(), save: j.fn() }],
      [ErpPurchaseOrderLine, { findOneBy: j.fn(), save: j.fn(), find: j.fn() }],
      [ErpProductionOrder, { findOneBy: j.fn(), save: j.fn() }],
      [ErpProductionOrderMaterial, { find: j.fn() }],
    ]);

    const { service } = makeServiceWithManager(makeManager(repoMap));

    await expect(
      service.postReceipt('gr2', { warehouseCode: 'WH1' }),
    ).rejects.toThrow('Phiếu nhập đã được ghi nhận trước đó');
  });

  it('postReceipt should throw when receipt has no lines', async () => {
    const receipt = {
      id: 'gr3',
      status: 'DRAFT',
      isDeleted: false,
    } as any;

    const receiptRepo = {
      findOneBy: j.fn().mockResolvedValue(receipt),
      save: j.fn(),
    };

    const lineRepo = {
      find: j.fn().mockResolvedValue([]),
    };

    const repoMap = new Map<any, any>([
      [ErpGoodsReceipt, receiptRepo],
      [ErpGoodsReceiptLine, lineRepo],
      [ErpInventoryTransaction, { create: j.fn(), save: j.fn() }],
      [ErpInventoryBalance, { findOne: j.fn(), save: j.fn() }],
      [ErpPurchaseOrder, { findOneBy: j.fn(), save: j.fn() }],
      [ErpPurchaseOrderLine, { findOneBy: j.fn(), save: j.fn(), find: j.fn() }],
      [ErpProductionOrder, { findOneBy: j.fn(), save: j.fn() }],
      [ErpProductionOrderMaterial, { find: j.fn() }],
    ]);

    const { service } = makeServiceWithManager(makeManager(repoMap));

    await expect(
      service.postReceipt('gr3', { warehouseCode: 'WH1' }),
    ).rejects.toThrow('Chưa nhập hàng nhập kho');
  });

  it('postReceipt should throw when PO line remaining qty is exceeded', async () => {
    const receipt = {
      id: 'gr4',
      receiptNo: 'NK-202607004',
      receiptDate: new Date('2026-07-20'),
      status: 'DRAFT',
      purchaseOrderId: 'po4',
      productionOrderId: null,
      createdBy: 'u1',
      isDeleted: false,
    } as any;

    const line = {
      id: 'grl4',
      goodsReceiptId: 'gr4',
      lineNo: 1,
      itemId: 'item1',
      qtyReceived: '5.000',
      unitCost: '100.000',
      purchaseOrderLineId: 'pol4',
    } as any;

    const balance = {
      itemId: 'item1',
      qtyOnHand: '20.000',
      avgUnitCost: '100.000',
      inventoryValue: '2000.000',
    } as any;

    const poLine = {
      id: 'pol4',
      purchaseOrderId: 'po4',
      qtyOrdered: '10.000',
      qtyReceived: '7.000',
    } as any;

    const receiptRepo = {
      findOneBy: j.fn().mockResolvedValue(receipt),
      save: j.fn(async (x: any) => x),
    };

    const lineRepo = {
      find: j.fn().mockResolvedValue([line]),
    };

    const txnRepo = {
      create: j.fn((x: any) => x),
      save: j.fn(async (x: any) => x),
      insert: j.fn(async (x: any) => x),
    };

    const repoMap = new Map<any, any>([
      [ErpGoodsReceipt, receiptRepo],
      [ErpGoodsReceiptLine, lineRepo],
      [ErpInventoryTransaction, txnRepo],
      [
        ErpInventoryBalance,
        {
          findOne: j.fn().mockResolvedValue(balance),
          find: j.fn().mockResolvedValue([balance]),
          findBy: j.fn().mockResolvedValue([balance]),
          save: j.fn(async (x: any) => x),
        },
      ],
      [ErpPurchaseOrder, { findOneBy: j.fn(), save: j.fn() }],
      [
        ErpPurchaseOrderLine,
        {
          findOneBy: j.fn().mockResolvedValue(poLine),
          save: j.fn(),
          find: j.fn().mockResolvedValue([poLine]),
          findBy: j.fn().mockResolvedValue([poLine]),
        },
      ],
      [ErpProductionOrder, { findOneBy: j.fn(), save: j.fn() }],
      [ErpProductionOrderMaterial, { find: j.fn() }],
    ]);

    const { service } = makeServiceWithManager(makeManager(repoMap));

    await expect(
      service.postReceipt('gr4', { warehouseCode: 'WH1' }),
    ).rejects.toThrow('vượt quá số lượng còn được nhận');
  });

  it('cancelReceipt should create reversal transaction, revert balance and PO qty', async () => {
    const receipt = {
      id: 'gr5',
      receiptNo: 'NK-202607005',
      receiptDate: new Date('2026-07-20'),
      status: 'POSTED',
      purchaseOrderId: 'po5',
      productionOrderId: null,
      isDeleted: false,
    } as any;

    const line = {
      id: 'grl5',
      goodsReceiptId: 'gr5',
      lineNo: 1,
      itemId: 'item1',
      qtyReceived: '5.000',
      unitCost: '100.000',
      purchaseOrderLineId: 'pol5',
    } as any;

    const balance = {
      itemId: 'item1',
      qtyOnHand: '25.000',
      inventoryValue: '2500.000',
      avgUnitCost: '100.000',
    } as any;

    const poLine = {
      id: 'pol5',
      purchaseOrderId: 'po5',
      qtyOrdered: '10.000',
      qtyReceived: '8.000',
    } as any;

    const po = {
      id: 'po5',
      status: 'RECEIVED',
    } as any;

    const dependencyService = { checkDependencies: j.fn() };

    const receiptRepo = {
      findOneBy: j.fn().mockResolvedValue(receipt),
      save: j.fn(async (x: any) => x),
    };

    const lineRepo = {
      find: j.fn().mockResolvedValue([line]),
    };

    const txnRepo = {
      create: j.fn((x: any) => x),
      save: j.fn(async (x: any) => x),
      insert: j.fn(async (x: any) => x),
    };

    const balanceRepo = {
      findOne: j.fn().mockResolvedValue(balance),
      find: j.fn().mockResolvedValue([balance]),
      findBy: j.fn().mockResolvedValue([balance]),
      save: j.fn(async (x: any) => x),
    };

    const poRepo = {
      findOneBy: j.fn().mockResolvedValue(po),
      save: j.fn(async (x: any) => x),
    };

    const poLineRepo = {
      findOneBy: j.fn().mockResolvedValue(poLine),
      save: j.fn(async (x: any) => x),
      find: j.fn().mockResolvedValue([poLine]),
      findBy: j.fn().mockResolvedValue([poLine]),
    };

    const repoMap = new Map<any, any>([
      [ErpGoodsReceipt, receiptRepo],
      [ErpGoodsReceiptLine, lineRepo],
      [ErpInventoryTransaction, txnRepo],
      [ErpInventoryBalance, balanceRepo],
      [ErpPurchaseOrder, poRepo],
      [ErpPurchaseOrderLine, poLineRepo],
      [ErpProductionOrder, { findOneBy: j.fn(), save: j.fn() }],
      [ErpProductionOrderMaterial, { find: j.fn() }],
    ]);

    const manager = makeManager(repoMap);
    const { service } = makeServiceWithManager(manager, dependencyService);

    await service.cancelReceipt('gr5');

    expect(dependencyService.checkDependencies).toHaveBeenCalledWith(
      'goods_receipts',
      'gr5',
    );
    expect(receipt.status).toBe('CANCELLED');
    expect(balance.qtyOnHand).toBe('20.000');
    expect(balance.inventoryValue).toBe('2000.000');
    expect(balance.avgUnitCost).toBe('100.000');
    expect(poLine.qtyReceived).toBe('3.000');
    expect(po.status).toBe('PARTIAL_RECEIVED');

    const txnCall = txnRepo.insert.mock.calls[0][0][0];
    expect(txnCall.transactionType).toBe('RECEIPT_CANCEL');
    expect(txnCall.qtyIn).toBe('0.000');
    expect(txnCall.qtyOut).toBe('5.000');
  });

  it('cancelReceipt should throw when receipt is DRAFT', async () => {
    const receipt = {
      id: 'gr6',
      status: 'DRAFT',
      isDeleted: false,
    } as any;

    const receiptRepo = {
      findOneBy: j.fn().mockResolvedValue(receipt),
      save: j.fn(),
    };

    const repoMap = new Map<any, any>([
      [ErpGoodsReceipt, receiptRepo],
      [ErpGoodsReceiptLine, { find: j.fn() }],
      [ErpInventoryTransaction, { create: j.fn(), save: j.fn() }],
      [ErpInventoryBalance, { findOne: j.fn(), save: j.fn() }],
      [ErpPurchaseOrder, { findOneBy: j.fn(), save: j.fn() }],
      [ErpPurchaseOrderLine, { findOneBy: j.fn(), save: j.fn(), find: j.fn() }],
      [ErpProductionOrder, { findOneBy: j.fn(), save: j.fn() }],
      [ErpProductionOrderMaterial, { find: j.fn() }],
    ]);

    const { service } = makeServiceWithManager(makeManager(repoMap));

    await expect(service.cancelReceipt('gr6')).rejects.toThrow(
      'Chỉ có thể hủy phiếu nhập đã ghi sổ (POSTED)',
    );
  });

  it('cancelReceipt should throw when receipt is already CANCELLED', async () => {
    const receipt = {
      id: 'gr7',
      status: 'CANCELLED',
      isDeleted: false,
    } as any;

    const receiptRepo = {
      findOneBy: j.fn().mockResolvedValue(receipt),
      save: j.fn(),
    };

    const repoMap = new Map<any, any>([
      [ErpGoodsReceipt, receiptRepo],
      [ErpGoodsReceiptLine, { find: j.fn() }],
      [ErpInventoryTransaction, { create: j.fn(), save: j.fn() }],
      [ErpInventoryBalance, { findOne: j.fn(), save: j.fn() }],
      [ErpPurchaseOrder, { findOneBy: j.fn(), save: j.fn() }],
      [ErpPurchaseOrderLine, { findOneBy: j.fn(), save: j.fn(), find: j.fn() }],
      [ErpProductionOrder, { findOneBy: j.fn(), save: j.fn() }],
      [ErpProductionOrderMaterial, { find: j.fn() }],
    ]);

    const { service } = makeServiceWithManager(makeManager(repoMap));

    await expect(service.cancelReceipt('gr7')).rejects.toThrow(
      'Phiếu nhập đã bị hủy trước đó',
    );
  });

  it('cancelReceipt should stop when dependency check fails', async () => {
    const receipt = {
      id: 'gr8',
      receiptNo: 'NK-202607008',
      status: 'POSTED',
      isDeleted: false,
    } as any;

    const dependencyService = {
      checkDependencies: j
        .fn()
        .mockRejectedValue(new Error('Document has dependencies')),
    };

    const txnRepo = {
      create: j.fn((x: any) => x),
      save: j.fn(async (x: any) => x),
      insert: j.fn(async (x: any) => x),
    };

    const receiptRepo = {
      findOneBy: j.fn().mockResolvedValue(receipt),
      save: j.fn(async (x: any) => x),
    };

    const repoMap = new Map<any, any>([
      [ErpGoodsReceipt, receiptRepo],
      [ErpGoodsReceiptLine, { find: j.fn().mockResolvedValue([]) }],
      [ErpInventoryTransaction, txnRepo],
      [ErpInventoryBalance, { findOne: j.fn(), save: j.fn() }],
      [ErpPurchaseOrder, { findOneBy: j.fn(), save: j.fn() }],
      [ErpPurchaseOrderLine, { findOneBy: j.fn(), save: j.fn(), find: j.fn() }],
      [ErpProductionOrder, { findOneBy: j.fn(), save: j.fn() }],
      [ErpProductionOrderMaterial, { find: j.fn() }],
    ]);

    const { service } = makeServiceWithManager(
      makeManager(repoMap),
      dependencyService,
    );

    await expect(service.cancelReceipt('gr8')).rejects.toThrow(
      'Document has dependencies',
    );
    expect(receipt.status).toBe('POSTED');
    expect(txnRepo.save).not.toHaveBeenCalled();
  });
});
