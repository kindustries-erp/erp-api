import { Reflector } from '@nestjs/core';
import { ErpAction, ErpResource } from '@/v2/core/rbac-core';
import { RBAC_PERMISSIONS_KEY } from '@/auth/decorators/require-permissions.decorator';
import { GarageGoodsReceiptsCoreService } from '../goods-receipts-garage-core.service';
import { CreateGarageGoodsReceiptDto } from '../dto/create-garage-goods-receipt.dto';
import { QueryGarageGoodsReceiptDto } from '../dto/query-garage-goods-receipt.dto';
import { UpdateGarageGoodsReceiptDto } from '../dto/update-garage-goods-receipt.dto';
import { GarageGoodsReceiptController } from './garage-goods-receipt.controller';

describe('GarageGoodsReceiptController', () => {
  let service: {
    findAll: jest.Mock;
    findColumnOptions: jest.Mock;
    getNextCode: jest.Mock;
    findOne: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    createAndPost: jest.Mock;
    updateAndPost: jest.Mock;
    post: jest.Mock;
    cancel: jest.Mock;
    remove: jest.Mock;
  };
  let controller: GarageGoodsReceiptController;
  const reflector = new Reflector();

  beforeEach(() => {
    service = {
      findAll: jest.fn(),
      findColumnOptions: jest.fn(),
      getNextCode: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      createAndPost: jest.fn(),
      updateAndPost: jest.fn(),
      post: jest.fn(),
      cancel: jest.fn(),
      remove: jest.fn(),
    };
    controller = new GarageGoodsReceiptController(
      service as unknown as GarageGoodsReceiptsCoreService,
    );
  });

  it('delegates the list query to the facade', async () => {
    const query = {} as QueryGarageGoodsReceiptDto;

    await controller.findAll(query);

    expect(service.findAll).toHaveBeenCalledWith(query);
  });

  it('delegates column options with parsed paging', async () => {
    await controller.columnOptions(
      'code',
      'ab',
      '2',
      '50',
      '{"status":["DRAFT"]}',
    );

    expect(service.findColumnOptions).toHaveBeenCalledWith(
      'code',
      'ab',
      2,
      50,
      '{"status":["DRAFT"]}',
    );
  });

  it('delegates getNextCode to facade', async () => {
    await controller.getNextCode('2026-11-03');
    expect(service.getNextCode).toHaveBeenCalledWith('2026-11-03');
  });

  it('delegates detail, create, update, post, cancel and remove with the id and DTO', async () => {
    const createDto = {} as CreateGarageGoodsReceiptDto;
    const updateDto = {} as UpdateGarageGoodsReceiptDto;

    await controller.findOne('id-1');
    await controller.create(createDto);
    await controller.update('id-1', updateDto);
    await controller.postReceipt('id-1');
    await controller.cancelReceipt('id-1');
    await controller.remove('id-1');

    expect(service.findOne).toHaveBeenCalledWith('id-1');
    expect(service.create).toHaveBeenCalledWith(createDto);
    expect(service.update).toHaveBeenCalledWith('id-1', updateDto);
    expect(service.post).toHaveBeenCalledWith('id-1');
    expect(service.cancel).toHaveBeenCalledWith('id-1');
    expect(service.remove).toHaveBeenCalledWith('id-1');
  });

  describe('RBAC permissions verification', () => {
    it('verifies all routes are protected with GARAGE_GOODS_RECEIPTS resource', () => {
      const endpoints = [
        { handler: controller.findAll, action: ErpAction.READ },
        { handler: controller.columnOptions, action: ErpAction.READ },
        { handler: controller.getNextCode, action: ErpAction.READ },
        { handler: controller.findOne, action: ErpAction.READ },
        { handler: controller.create, action: ErpAction.CREATE },
        { handler: controller.update, action: ErpAction.UPDATE },
        { handler: controller.postReceipt, action: ErpAction.UPDATE },
        { handler: controller.cancelReceipt, action: ErpAction.UPDATE },
        { handler: controller.remove, action: ErpAction.DELETE },
      ];

      for (const ep of endpoints) {
        const perms = reflector.get(RBAC_PERMISSIONS_KEY, ep.handler);
        expect(perms).toBeDefined();
        expect(perms).toEqual(
          expect.arrayContaining([
            {
              resource: ErpResource.GARAGE_GOODS_RECEIPTS,
              action: ep.action,
            },
          ]),
        );
      }
    });
  });

  it('save-and-post: tạo cần CREATE và UPDATE, sửa cần UPDATE, ủy quyền cho facade', async () => {
    const dto = {} as CreateGarageGoodsReceiptDto;
    await controller.createAndPost(dto);
    await controller.updateAndPost('id-1', dto);
    expect(service.createAndPost).toHaveBeenCalledWith(dto);
    expect(service.updateAndPost).toHaveBeenCalledWith('id-1', dto);

    const perms = (fn: object) =>
      (reflector.get(RBAC_PERMISSIONS_KEY, fn as never) ?? []).map(
        (p: { action: ErpAction }) => p.action,
      );
    expect(perms(GarageGoodsReceiptController.prototype.createAndPost)).toEqual(
      [ErpAction.CREATE, ErpAction.UPDATE],
    );
    expect(perms(GarageGoodsReceiptController.prototype.updateAndPost)).toEqual(
      [ErpAction.UPDATE],
    );
  });
});
