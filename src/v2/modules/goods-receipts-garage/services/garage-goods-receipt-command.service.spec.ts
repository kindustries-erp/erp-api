import { BadRequestException } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { GarageGoodsReceipt } from '../entities/garage-goods-receipt.entity';
import { CreateGarageGoodsReceiptDto } from '../dto/create-garage-goods-receipt.dto';
import { GarageGoodsReceiptCommandService } from './garage-goods-receipt-command.service';
import { GarageProcurementOrder } from '@/v2/modules/procurement-orders-garage/entities/procurement-order.entity';
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
  let flow: { postReceipt: jest.Mock; cancelReceipt: jest.Mock };
  let dataSource: { transaction: jest.Mock };
  let voucherEngine: BaseVoucherEngineService;
  let service: GarageGoodsReceiptCommandService;
  let lockedReceipt: GarageGoodsReceipt | null;
  let order: Partial<GarageProcurementOrder> | null;

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
    flow = {
      postReceipt: jest.fn(async (id: string) => ({ id, status: 'POSTED' })),
      cancelReceipt: jest.fn(async (id: string) => ({
        id,
        status: 'CANCELLED',
      })),
    };

    lockedReceipt = null;
    order = {
      id: 'po-0',
      status: 'ISSUED',
      fulfillmentStatus: 'NONE',
      supplierId: 'sup-1',
      supplierName: 'NCC theo đơn',
      branchId: 'br-1',
      branchName: 'Chi nhánh đơn',
    };
    const manager = {
      getRepository: jest.fn((entityClass) => {
        if (entityClass === GarageGoodsReceipt) return repo;
        if (entityClass.name === 'GarageGoodsReceiptLine') return lineRepo;
        return undefined;
      }),
      findOne: jest.fn((entityClass) => {
        if (entityClass === GarageGoodsReceipt) return lockedReceipt;
        if (entityClass === GarageProcurementOrder) return order;
        return null;
      }),
      save: jest.fn((_entityClass, value) => Promise.resolve(value)),
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
      flow as never,
    );
  });

  it('creates an active row from the DTO with lines in transaction', async () => {
    const dto: CreateGarageGoodsReceiptDto = {
      garageProcurementOrderId: 'po-0',
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

  it('extraData khi sửa phiếu nháp: merge cấp 1, null xóa key', async () => {
    const entity = {
      id: 'id-1',
      status: 'DRAFT',
      isDeleted: false,
      extraData: { a: 1, b: 2 },
    } as unknown as GarageGoodsReceipt;
    lockedReceipt = { ...entity } as GarageGoodsReceipt;

    await service.update(entity, { extraData: { b: 3, a: null } });

    expect(repo.save).toHaveBeenCalledWith(
      expect.objectContaining({ extraData: { b: 3 } }),
    );
  });

  it('tạo phiếu không gửi extraData thì lưu {}', async () => {
    const saved = await service.create({
      receiptNo: 'GGR-1',
      receiptDate: '2026-11-03',
      supplierName: 'NCC',
      lines: [{ itemName: 'Bố thắng', qtyReceived: 1, unitCost: 10 }],
    } as never);

    expect(saved.extraData).toEqual({});
  });

  it('từ chối extraData sai định dạng trước khi mở transaction', async () => {
    await expect(
      service.create({
        receiptNo: 'GGR-2',
        receiptDate: '2026-11-03',
        extraData: 'x' as never,
      } as never),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it('update kiểm trạng thái trên bản đã khóa (DRAFT trong entity, POSTED trong DB) và không ghi gì', async () => {
    const entity = { id: 'id-1', status: 'DRAFT' } as GarageGoodsReceipt;
    lockedReceipt = { ...entity, status: 'POSTED' } as GarageGoodsReceipt;

    await expect(service.update(entity, {})).rejects.toThrow();
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('post và cancel giao cho orchestrator luồng mua garage', async () => {
    const entity = { id: 'id-1', status: 'DRAFT' } as GarageGoodsReceipt;

    await expect(service.post(entity)).resolves.toMatchObject({
      status: 'POSTED',
    });
    await expect(service.cancel(entity)).resolves.toMatchObject({
      status: 'CANCELLED',
    });
    expect(flow.postReceipt).toHaveBeenCalledWith('id-1');
    expect(flow.cancelReceipt).toHaveBeenCalledWith('id-1');
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

  describe('phiếu gắn đơn mua', () => {
    const lines = [{ itemName: 'Bố thắng', qtyReceived: 2, unitCost: 100 }];

    it('ghi đè NCC, chi nhánh theo đơn và tính tổng tiền từ dòng, bỏ giá trị client', async () => {
      await service.create({
        garageProcurementOrderId: 'po-0',
        receiptNo: 'GGR-1',
        receiptDate: '2026-11-03',
        supplierId: 'sup-khac',
        supplierName: 'NCC tự gõ',
        branchName: 'Chi nhánh tự gõ',
        totalAmount: 999999,
        lines,
      } as never);

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          supplierId: 'sup-1',
          supplierName: 'NCC theo đơn',
          branchId: 'br-1',
          branchName: 'Chi nhánh đơn',
          totalAmount: '200',
        }),
      );
    });

    it.each([
      ['không tồn tại', null],
      ['chưa phát hành', { status: 'APPROVED', fulfillmentStatus: 'NONE' }],
      ['đã nhận đủ', { status: 'ISSUED', fulfillmentStatus: 'FULL' }],
    ])('từ chối đơn mua %s', async (_label, value) => {
      order = value as Partial<GarageProcurementOrder> | null;
      await expect(
        service.create({
          garageProcurementOrderId: 'po-0',
          receiptNo: 'GGR-1',
          receiptDate: '2026-11-03',
          lines,
        } as never),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('sửa phiếu đã có đơn: không đổi được đơn mua', async () => {
      const entity = { id: 'id-1', status: 'DRAFT' } as GarageGoodsReceipt;
      lockedReceipt = {
        ...entity,
        garageProcurementOrderId: 'po-0',
      } as GarageGoodsReceipt;

      await expect(
        service.update(entity, { garageProcurementOrderId: 'po-khac' }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('sửa phiếu đã có đơn: bỏ NCC/tổng client gửi, tổng tính lại từ dòng', async () => {
      const entity = { id: 'id-1', status: 'DRAFT' } as GarageGoodsReceipt;
      lockedReceipt = {
        ...entity,
        garageProcurementOrderId: 'po-0',
        supplierName: 'NCC theo đơn',
      } as GarageGoodsReceipt;

      await service.update(entity, {
        supplierName: 'NCC tự gõ',
        totalAmount: 1,
        lines,
      } as never);

      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          supplierName: 'NCC theo đơn',
          totalAmount: '200',
        }),
      );
    });
  });
});
