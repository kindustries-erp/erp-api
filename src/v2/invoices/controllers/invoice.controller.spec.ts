import { InvoicesService } from '../invoices.service';
import { CreateInvoiceDto } from '../dto/create-invoice.dto';
import { QueryInvoiceDto } from '../dto/query-invoice.dto';
import { UpdateInvoiceDto } from '../dto/update-invoice.dto';
import { InvoiceController } from './invoice.controller';

describe('InvoiceController', () => {
  let service: {
    findAll: jest.Mock;
    findColumnOptions: jest.Mock;
    findOne: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    remove: jest.Mock;
  };
  let controller: InvoiceController;

  beforeEach(() => {
    service = {
      findAll: jest.fn(),
      findColumnOptions: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    };
    controller = new InvoiceController(service as unknown as InvoicesService);
  });

  it('delegates the list query to the facade', async () => {
    const query = {} as QueryInvoiceDto;

    await controller.findAll(query);

    expect(service.findAll).toHaveBeenCalledWith(query);
  });

  it('delegates column options with parsed paging', async () => {
    await controller.columnOptions(
      'code',
      'ab',
      '2',
      '50',
      '{"status":["ACTIVE"]}',
    );

    expect(service.findColumnOptions).toHaveBeenCalledWith(
      'code',
      'ab',
      2,
      50,
      '{"status":["ACTIVE"]}',
    );
  });

  it('delegates detail, create, update and remove with the id and DTO', async () => {
    const createDto = {} as CreateInvoiceDto;
    const updateDto = {} as UpdateInvoiceDto;

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
