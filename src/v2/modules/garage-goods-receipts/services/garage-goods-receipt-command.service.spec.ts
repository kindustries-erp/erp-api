import { DataSource, Repository } from 'typeorm';
import { GarageGoodsReceipt } from '../entities/garage-goods-receipt.entity';
import { CreateGarageGoodsReceiptDto } from '../dto/create-garage-goods-receipt.dto';
import { GarageGoodsReceiptCommandService } from './garage-goods-receipt-command.service';
import { BaseVoucherEngineService } from '@/v2/core/goods-receipts/services/base-voucher-engine.service';

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

    const manager = {
      getRepository: jest.fn((entityClass) => {
        if (entityClass === GarageGoodsReceipt) return repo;
        if (entityClass.name === 'GarageGoodsReceiptLine') return lineRepo;
        return balanceRepo;
      }),
    };

    dataSource = {
      transaction: jest.fn((callback) => callback(manager)),
    };

    voucherEngine = new BaseVoucherEngineService();

    service = new GarageGoodsReceiptCommandService(
      dataSource as unknown as DataSource,
      repo as unknown as Repository<GarageGoodsReceipt>,
      voucherEngine,
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

    await service.update(entity, {});

    expect(dataSource.transaction).toHaveBeenCalledTimes(1);
    expect(repo.save).toHaveBeenCalledWith(entity);
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

    await service.post(entity);

    expect(entity.status).toBe('POSTED');
    expect(balanceRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ itemCode: 'LOC-GIO', qtyOnHand: '5' }),
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
