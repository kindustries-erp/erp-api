import { Repository } from 'typeorm';
import { Invoice } from '../entities/invoice.entity';
import { CreateInvoiceDto } from '../dto/create-invoice.dto';
import { InvoiceCommandService } from './invoice-command.service';

describe('InvoiceCommandService', () => {
  let repo: { create: jest.Mock; save: jest.Mock };
  let service: InvoiceCommandService;

  beforeEach(() => {
    repo = {
      create: jest.fn((value: object) => value),
      save: jest.fn((value: object) => Promise.resolve(value)),
    };
    service = new InvoiceCommandService(repo as unknown as Repository<Invoice>);
  });

  it('creates an active row from the DTO', async () => {
    const dto: CreateInvoiceDto = {
      invoiceNo: 'sample',
      serialNo: 'sample',
      invoiceDate: 'sample',
      direction: 'sample',
      status: 'sample',
      sellerName: 'sample',
      sellerTaxCode: 'sample',
      buyerName: 'sample',
      buyerTaxCode: 'sample',
      description: 'sample',
      invoiceType: 'sample',
      invoiceCategory: 'sample',
      preVatAmount: 12.5,
      vatRate: 12.5,
      vatAmount: 12.5,
      discountAmount: 12.5,
      totalAmount: 12.5,
      notes: 'sample',
    };

    const saved = await service.create(dto);

    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({ isDeleted: false }),
    );
    expect(repo.save).toHaveBeenCalledTimes(1);
    expect(saved).toMatchObject({ isDeleted: false });
  });

  it('keeps existing values when the update DTO is empty', async () => {
    const entity = { id: 'id-1', isDeleted: false } as Invoice;

    await service.update(entity, {});

    expect(Object.keys(entity)).toEqual(['id', 'isDeleted']);
    expect(repo.save).toHaveBeenCalledWith(entity);
  });

  it('soft-deletes by flagging isDeleted', async () => {
    const entity = { id: 'id-1', isDeleted: false } as Invoice;

    await service.softDelete(entity);

    expect(entity.isDeleted).toBe(true);
    expect(repo.save).toHaveBeenCalledWith(entity);
  });
});
