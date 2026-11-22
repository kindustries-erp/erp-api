import { BusinessPartnersManagementService } from '../business-partners-management.service';
import {
  CreateErpBusinessPartnerDto,
  QueryErpBusinessPartnerDto,
  UpdateErpBusinessPartnerDto,
} from '@/v2/core/business-partners-core';
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
      service as unknown as BusinessPartnersManagementService,
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

  it('delegates next-code with partnerType query', async () => {
    await controller.getNextCode('CUSTOMER');

    expect(service.getNextCode).toHaveBeenCalledWith('CUSTOMER');
  });

  it('delegates detail lookup', async () => {
    await controller.findOne('id-1');

    expect(service.findOne).toHaveBeenCalledWith('id-1');
  });

  it('delegates create', async () => {
    const dto = {} as CreateErpBusinessPartnerDto;

    await controller.create(dto);

    expect(service.create).toHaveBeenCalledWith(dto);
  });

  it('delegates update', async () => {
    const dto = {} as UpdateErpBusinessPartnerDto;

    await controller.update('id-1', dto);

    expect(service.update).toHaveBeenCalledWith('id-1', dto);
  });

  it('delegates remove', async () => {
    await controller.remove('id-1');

    expect(service.remove).toHaveBeenCalledWith('id-1');
  });
});
