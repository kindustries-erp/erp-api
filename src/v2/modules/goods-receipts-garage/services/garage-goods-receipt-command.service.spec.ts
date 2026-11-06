import { DataSource, Repository } from 'typeorm';
import { GarageGoodsReceipt } from '../entities/garage-goods-receipt.entity';
import { CreateGarageGoodsReceiptDto } from '../dto/create-garage-goods-receipt.dto';
import { GarageGoodsReceiptCommandService } from './garage-goods-receipt-command.service';
import { GarageInventoryBalanceService } from './garage-inventory-balance.service';
import { GarageInventoryBalance } from '../entities/garage-inventory-balance.entity';
import { BaseVoucherEngineService } from '@/v2/core/goods-receipts-core/services/base-voucher-engine.service';

describe('GarageGoodsReceiptCommandService', () => {
  let repo: {
    create: jest.Mock;
    save: jest.Mock;
    createQueryBuilder: jest.Mock;
  };
  let lineRepo: {
    create: jest.Mock;
    save: jest.Mock;
    delete: jest.Mock;
    find: jest.Mock;
  };
  let balanceRepo: { create: jest.Mock; save: jest.Mock; findOne: jest.Mock };
  let dataSource: { transaction: jest.Mock };
  let voucherEngine: BaseVoucherEngineService;
  let service: GarageGoodsReceiptCommandService;
  let lockedReceipt: GarageGoodsReceipt | null;

  beforeEach(() => {
    repo = {
      create: jest.fn((value: object) => value),
      save: jest.fn((value: object) => Promise.resolve(value)),
      createQueryBuilder: jest.fn(),
    };
    lineRepo = {
      create: jest.fn((value: object) => value),
      save: jest.fn((value: object) => Promise.resolve(value)),
      delete: jest.fn().mockResolvedValue({}),
      find: jest.fn().mockResolvedValue([]),
    };
    balanceRepo = {
      create: jest.fn((value: object) => value),
      save: jest.fn((value: object) => Promise.resolve(value)),
      findOne: jest.fn().mockResolvedValue(null),
    };

    lockedReceipt = null;
    const manager = {
      getRepository: jest.fn((entityClass) => {
        if (entityClass === GarageGoodsReceipt) return repo;
        if (entityClass.name === 'GarageGoodsReceiptLine') return lineRepo;
        return balanceRepo;
      }),
      findOne: jest.fn((entityClass, options) => {
        if (entityClass === GarageGoodsReceipt) return lockedReceipt;
        return balanceRepo.findOne(options);
      }),
      save: jest.fn((entityClass, value) =>
        entityClass === GarageInventoryBalance
          ? balanceRepo.save(value)
          : Promise.resolve(value),
      ),
      query: jest.fn().mockResolvedValue(undefined),
    };

    dataSource = {
      transaction: jest.fn((callback) => callback(manager)),
    };

    voucherEngine = new BaseVoucherEngineService();

    service = new GarageGoodsReceiptCommandService(
      dataSource as unknown as DataSource,
      repo as unknown as Repository<GarageGoodsReceipt>,
      voucherEngine,
      { applyGoodsReceipt: jest.fn(), revertGoodsReceipt: jest.fn() } as never,
      new GarageInventoryBalanceService(),
    );
  });

  it('creates an active row from the DTO with lines in transaction', async () => {
    const dto: CreateGarageGoodsReceiptDto = {
      receiptNo: 'GGR-20261103-001',
      receiptDate: '2026-11-03T00:00:00.000Z',
      supplierName: 'NCC Phụ Tùng',
      branchName: 'Garage 1',
      status: 'DRAFT',
      lines: [
        {
          itemCode: 'BO-THANG',
          itemName: 'Bố thắng đĩa',
          qtyReceived: 2,
          unitCost: 100000,
          amount: 200000,
        },
      ],
    };

    const saved = await service.create(dto);

    expect(dataSource.transaction).toHaveBeenCalledTimes(1);
    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({ isDeleted: false, status: 'DRAFT' }),
    );
    expect(repo.save).toHaveBeenCalledTimes(1);
    expect(saved).toMatchObject({ isDeleted: false });
  });

  it('keeps existing values when update DTO is empty and status is DRAFT', async () => {
    const entity = {
      id: 'id-1',
      status: 'DRAFT',
      isDeleted: false,
    } as GarageGoodsReceipt;

    lockedReceipt = { ...entity } as GarageGoodsReceipt;

    await service.update(entity, {});

    expect(dataSource.transaction).toHaveBeenCalledTimes(1);
    expect(repo.save).toHaveBeenCalledWith(entity);
  });

  it('update kiểm trạng thái trên bản đã khóa (DRAFT trong entity, POSTED trong DB) và không ghi gì', async () => {
    const entity = { id: 'id-1', status: 'DRAFT' } as GarageGoodsReceipt;
    lockedReceipt = { ...entity, status: 'POSTED' } as GarageGoodsReceipt;

    await expect(service.update(entity, {})).rejects.toThrow();
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('posts goods receipt and updates stock balance', async () => {
    const line = {
      id: 'l-1',
      itemCode: 'LOC-GIO',
      itemName: 'Lọc gió',
      unit: 'Cái',
      qtyReceived: '5',
      unitCost: '50000',
    };
    const entity = {
      id: 'id-1',
      status: 'DRAFT',
      branchId: 'br-1',
      lines: [line],
    } as unknown as GarageGoodsReceipt;
    lockedReceipt = entity;
    lineRepo.find.mockResolvedValueOnce([line]);
    balanceRepo.findOne.mockResolvedValueOnce({
      itemCode: 'LOC-GIO',
      qtyOnHand: '0',
      avgCost: '0',
    });

    await service.post(entity);

    expect(entity.status).toBe('POSTED');
    expect(balanceRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        itemCode: 'LOC-GIO',
        qtyOnHand: '5',
        avgCost: '50000',
      }),
    );
    expect(repo.save).toHaveBeenCalledWith(entity);
  });

  it('soft-deletes by flagging isDeleted when status is DRAFT', async () => {
    const entity = {
      id: 'id-1',
      status: 'DRAFT',
      isDeleted: false,
    } as GarageGoodsReceipt;

    await service.softDelete(entity);

    expect(entity.isDeleted).toBe(true);
    expect(repo.save).toHaveBeenCalledWith(entity);
  });
});
