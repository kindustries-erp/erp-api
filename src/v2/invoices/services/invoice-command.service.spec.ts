import { BadRequestException } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { Invoice } from '../entities/invoice.entity';
import { InvoiceItem } from '../entities/invoice-item.entity';
import { CreateInvoiceDto } from '../dto/create-invoice.dto';
import { UpdateInvoiceDto } from '../dto/update-invoice.dto';
import { INVOICE_MESSAGES } from '../invoice-messages';
import { InvoiceCommandService } from './invoice-command.service';

describe('InvoiceCommandService', () => {
  let repo: { find: jest.Mock; update: jest.Mock };
  let manager: {
    create: jest.Mock;
    save: jest.Mock;
    find: jest.Mock;
    delete: jest.Mock;
  };
  let service: InvoiceCommandService;

  beforeEach(() => {
    repo = { find: jest.fn(), update: jest.fn() };
    manager = {
      create: jest.fn((_target, values) => ({ ...values })),
      save: jest.fn(async (_target, value) =>
        Array.isArray(value) ? value : { id: 'inv-1', ...value },
      ),
      find: jest.fn().mockResolvedValue([]),
      delete: jest.fn(),
    };
    const dataSource = {
      transaction: jest.fn((run: (m: typeof manager) => unknown) =>
        run(manager),
      ),
    };
    service = new InvoiceCommandService(
      repo as unknown as Repository<Invoice>,
      {} as unknown as Repository<InvoiceItem>,
      dataSource as unknown as DataSource,
    );
  });

  const savedInvoice = () =>
    manager.save.mock.calls.find(([t]) => t === Invoice)?.[1];
  const savedItems = () =>
    manager.save.mock.calls.find(([t]) => t === InvoiceItem)?.[1] ?? [];

  describe('create', () => {
    it('resolves branches, normalizes the invoice number and extracts metadata', async () => {
      const dto = {
        invoiceNo: '0012',
        invoiceDate: '2026-01-01',
        direction: 'IN',
        branchIds: ['b1', 'b1', 'b2'],
        items: [{ description: 'Lọc gió 50H-38666 QT50-WO-9' }],
      } as unknown as CreateInvoiceDto;

      await service.create(dto, 'user-1');

      const invoice = savedInvoice();
      expect(invoice.branchIds).toEqual(['b1', 'b2']);
      expect(invoice.branchId).toBe('b1');
      expect(invoice.invoiceNoNormalized).toBe('12');
      expect(invoice.createdBy).toBe('user-1');
      expect(invoice.settlementOrder).toBe('50-WO-9');
      expect(invoice.licensePlate).toBe('50H-38666');
    });

    it('saves items with the new invoice id and normalized unit', async () => {
      const dto = {
        invoiceNo: 'A1',
        invoiceDate: '2026-01-01',
        direction: 'IN',
        items: [{ description: 'Dầu', unit: ' lít ', quantity: 2 }],
      } as unknown as CreateInvoiceDto;

      await service.create(dto, null);

      const [item] = savedItems();
      expect(item.invoiceId).toBe('inv-1');
      expect(item.unit).toBe('LÍT');
      expect(item.quantity).toBe('2');
    });

    it('leaves branches empty when none are sent', async () => {
      await service.create(
        { invoiceNo: 'A1' } as unknown as CreateInvoiceDto,
        null,
      );

      expect(savedInvoice().branchIds).toEqual([]);
      expect(savedInvoice().branchId).toBeNull();
    });
  });

  describe('update', () => {
    const posted = (over: Partial<Invoice> = {}) =>
      ({
        id: 'inv-1',
        direction: 'IN',
        sellerName: 'NCC',
        sellerTaxCode: '0100000001',
        postingStatus: 'POSTED',
        branchIds: ['b1'],
        branchId: 'b1',
        ...over,
      }) as Invoice;

    it('rejects a branch change on a POSTED invoice', async () => {
      const entity = posted();

      await expect(
        service.update(entity, { branchIds: ['b2'] } as UpdateInvoiceDto),
      ).rejects.toThrow(
        new BadRequestException(INVOICE_MESSAGES.BRANCH_LOCKED_POSTED),
      );
      expect(manager.save).not.toHaveBeenCalled();
    });

    it('allows a POSTED invoice to keep the same branches', async () => {
      await service.update(posted(), { branchIds: ['b1'] } as UpdateInvoiceDto);

      expect(savedInvoice().branchIds).toEqual(['b1']);
    });

    it('replaces items and keeps existing item codes for the same description', async () => {
      manager.find.mockResolvedValue([
        { description: 'Lọc gió', itemCode: 'MA-OLD' },
      ]);
      const entity = posted({ postingStatus: 'UNPOSTED' });

      await service.update(entity, {
        items: [{ description: ' Lọc gió ' }],
      } as UpdateInvoiceDto);

      expect(manager.delete).toHaveBeenCalledWith(InvoiceItem, {
        invoiceId: 'inv-1',
      });
      expect(savedItems()[0].itemCode).toBe('PT-MA-OLD');
    });

    it('normalizes the invoice number when it changes', async () => {
      const entity = posted({ postingStatus: 'UNPOSTED' });

      await service.update(entity, {
        invoiceNo: 'X-00099',
      } as UpdateInvoiceDto);

      expect(savedInvoice().invoiceNoNormalized).toBe('X-99');
    });
  });

  describe('bulkSetBranch', () => {
    it('skips POSTED invoices and reports them', async () => {
      repo.find.mockResolvedValue([
        { id: 'a', postingStatus: 'DRAFT' },
        { id: 'b', postingStatus: 'POSTED' },
      ]);

      const result = await service.bulkSetBranch(['a', 'b'], ['b1']);

      expect(result).toEqual({ updated: 1, ids: ['a'], skipped: ['b'] });
      expect(repo.update).toHaveBeenCalledTimes(1);
    });

    it('does nothing for an empty list', async () => {
      const result = await service.bulkSetBranch([], ['b1']);

      expect(result).toEqual({ updated: 0, ids: [], skipped: [] });
      expect(repo.find).not.toHaveBeenCalled();
    });
  });

  describe('bulkSetNotes', () => {
    it('stores an empty note as null', async () => {
      repo.find.mockResolvedValue([{ id: 'a' }]);

      const result = await service.bulkSetNotes(['a'], '');

      expect(result).toEqual({ updated: 1, ids: ['a'] });
      expect(repo.update).toHaveBeenCalledWith(expect.anything(), {
        notes: null,
      });
    });
  });
});
