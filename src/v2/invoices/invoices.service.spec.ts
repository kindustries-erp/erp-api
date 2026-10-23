import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Invoice } from './entities/invoice.entity';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { QueryInvoiceDto } from './dto/query-invoice.dto';
import { InvoiceCommandService } from './services/invoice-command.service';
import { InvoiceQueryService } from './services/invoice-query.service';
import { InvoicesService } from './invoices.service';
import { R2Service } from '@/r2/r2.service';
import { INVOICE_MESSAGES } from './invoice-messages';

describe('InvoicesService', () => {
  const createdAt = new Date('2026-01-01T00:00:00.000Z');
  const row = {
    id: 'id-1',
    status: 'DRAFT',
    isDeleted: false,
    createdAt,
    updatedAt: createdAt,
  } as Invoice;

  let query: {
    findAll: jest.Mock;
    findById: jest.Mock;
    findColumnOptions: jest.Mock;
  };
  let command: { create: jest.Mock; update: jest.Mock; softDelete: jest.Mock };
  let r2: { deleteObject: jest.Mock };
  let service: InvoicesService;

  beforeEach(() => {
    query = {
      findAll: jest.fn(),
      findById: jest.fn(),
      findColumnOptions: jest.fn(),
    };
    command = { create: jest.fn(), update: jest.fn(), softDelete: jest.fn() };
    r2 = { deleteObject: jest.fn().mockResolvedValue(undefined) };
    service = new InvoicesService(
      query as unknown as InvoiceQueryService,
      command as unknown as InvoiceCommandService,
      r2 as unknown as R2Service,
    );
  });

  it('wraps a response DTO in the message/data envelope without isDeleted', async () => {
    query.findById.mockResolvedValue(row);

    const result = await service.findOne('id-1');

    expect(result.data.id).toBe('id-1');
    expect(result.message).toBe(INVOICE_MESSAGES.FETCHED);
    expect(result.data).not.toHaveProperty('isDeleted');
  });

  it('throws NotFound when the row is missing or soft-deleted', async () => {
    query.findById.mockResolvedValue(null);

    await expect(service.findOne('missing')).rejects.toThrow(
      new NotFoundException(INVOICE_MESSAGES.NOT_FOUND),
    );
  });

  it('maps paginated items to response DTOs with totalPages', async () => {
    query.findAll.mockResolvedValue({
      items: [row],
      total: 41,
      page: 1,
      pageSize: 20,
    });

    const result = await service.findAll({} as QueryInvoiceDto);

    expect(result.total).toBe(41);
    expect(result.totalPages).toBe(3);
    expect(result.items[0]).not.toHaveProperty('isDeleted');
  });

  it('passes summaries through with the page', async () => {
    query.findAll.mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      pageSize: 20,
      summaries: { amount: 9 },
    });

    const result = await service.findAll({} as QueryInvoiceDto);

    expect(result.summaries).toEqual({ amount: 9 });
  });

  it('delegates column options to the query service', async () => {
    query.findColumnOptions.mockResolvedValue({
      items: [],
      total: 0,
      next: null,
    });

    await service.findColumnOptions('code', undefined, 1, 20, undefined);

    expect(query.findColumnOptions).toHaveBeenCalledWith(
      'code',
      undefined,
      1,
      20,
      undefined,
    );
  });

  it('creates and returns the envelope with a response DTO', async () => {
    command.create.mockResolvedValue(row);

    const result = await service.create({} as CreateInvoiceDto);

    expect(result.data.id).toBe('id-1');
    expect(result.message).toBe(INVOICE_MESSAGES.CREATED);
  });

  it('soft-deletes a DRAFT row, removes its XML from R2 and returns the envelope', async () => {
    const withXml = { ...row, xmlFileKey: 'xml/id-1.xml' } as Invoice;
    query.findById.mockResolvedValue(withXml);
    command.softDelete.mockResolvedValue({ ...withXml, isDeleted: true });

    const result = await service.remove('id-1');

    expect(command.softDelete).toHaveBeenCalledWith(withXml);
    expect(r2.deleteObject).toHaveBeenCalledWith('xml/id-1.xml');
    expect(result.data.id).toBe('id-1');
    expect(result.data).not.toHaveProperty('isDeleted');
  });

  it('rejects deleting a non-DRAFT invoice (v1 rule)', async () => {
    query.findById.mockResolvedValue({ ...row, status: 'POSTED' } as Invoice);

    await expect(service.remove('id-1')).rejects.toThrow(
      new BadRequestException(INVOICE_MESSAGES.DELETE_NOT_DRAFT),
    );
    expect(command.softDelete).not.toHaveBeenCalled();
  });

  it('still succeeds when the R2 cleanup fails', async () => {
    query.findById.mockResolvedValue({
      ...row,
      xmlFileKey: 'xml/id-1.xml',
    } as Invoice);
    command.softDelete.mockResolvedValue({ ...row, isDeleted: true });
    r2.deleteObject.mockRejectedValue(new Error('r2 down'));

    const result = await service.remove('id-1');

    expect(result.data.id).toBe('id-1');
  });
});
