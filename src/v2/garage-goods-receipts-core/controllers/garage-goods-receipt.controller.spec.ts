import { GarageGoodsReceiptsCoreService } from '../garage-goods-receipts-core.service';
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
    post: jest.Mock;
    cancel: jest.Mock;
    remove: jest.Mock;
  };
  let controller: GarageGoodsReceiptController;

  beforeEach(() => {
    service = {
      findAll: jest.fn(),
      findColumnOptions: jest.fn(),
      getNextCode: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
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
});
