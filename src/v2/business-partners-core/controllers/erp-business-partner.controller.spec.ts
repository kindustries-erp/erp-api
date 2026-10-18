import { BusinessPartnersCoreService } from '../business-partners-core.service';
import { CreateErpBusinessPartnerDto } from '../dto/create-erp-business-partner.dto';
import { QueryErpBusinessPartnerDto } from '../dto/query-erp-business-partner.dto';
import { UpdateErpBusinessPartnerDto } from '../dto/update-erp-business-partner.dto';
import { ErpBusinessPartnerController } from './erp-business-partner.controller';

describe('ErpBusinessPartnerController', () => {
  let service: {
    findAll: jest.Mock;
    findColumnOptions: jest.Mock;
    getNextCode: jest.Mock;
    findOne: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    remove: jest.Mock;
  };
  let controller: ErpBusinessPartnerController;

  beforeEach(() => {
    service = {
      findAll: jest.fn(),
      findColumnOptions: jest.fn(),
      getNextCode: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    };
    controller = new ErpBusinessPartnerController(
      service as unknown as BusinessPartnersCoreService,
    );
  });

  it('delegates the list query to the facade', async () => {
    const query = {} as QueryErpBusinessPartnerDto;

    await controller.findAll(query);

    expect(service.findAll).toHaveBeenCalledWith(query);
  });

  it('delegates column options with parsed paging and the partner type scope', async () => {
    await controller.columnOptions(
      'code',
      'ab',
      '2',
      '50',
      '{"status":["ACTIVE"]}',
      'VENDOR',
    );

    expect(service.findColumnOptions).toHaveBeenCalledWith(
      'code',
      'ab',
      2,
      50,
      '{"status":["ACTIVE"]}',
      'VENDOR',
    );
  });

  it('delegates next-code with the partner type', async () => {
    await controller.getNextCode('CUSTOMER');

    expect(service.getNextCode).toHaveBeenCalledWith('CUSTOMER');
  });

  it('delegates detail, create, update and remove with the id and DTO', async () => {
    const createDto = {} as CreateErpBusinessPartnerDto;
    const updateDto = {} as UpdateErpBusinessPartnerDto;

    await controller.findOne('id-1');
    await controller.create(createDto);
    await controller.update('id-1', updateDto);
    await controller.remove('id-1');

    expect(service.findOne).toHaveBeenCalledWith('id-1');
    expect(service.create).toHaveBeenCalledWith(createDto);
    expect(service.update).toHaveBeenCalledWith('id-1', updateDto);
    expect(service.remove).toHaveBeenCalledWith('id-1');
  });
});
