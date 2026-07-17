import { ErpInvoicesCoreService } from './erp-invoices-core.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('ErpInvoicesCoreService', () => {
  let service: ErpInvoicesCoreService;
  let repository: any;
  let companyProfileRepo: any;
  let r2Service: any;
  let bankTransactionsCoreService: any;
  let notificationsService: any;
  let accountingCoreService: any;

  beforeEach(() => {
    repository = {
      findOne: jest.fn(),
      save: jest.fn().mockImplementation((data) => Promise.resolve(data)),
      manager: {
        find: jest.fn().mockResolvedValue([]),
        delete: jest.fn().mockResolvedValue({}),
      },
    };
    companyProfileRepo = {};
    bankTransactionsCoreService = {};
    notificationsService = {};
    r2Service = {};
    accountingCoreService = {
      createJournalEntry: jest.fn().mockResolvedValue({ id: 'je-123' }),
      deleteJournalEntryBySource: jest.fn().mockResolvedValue(true),
    };

    service = new ErpInvoicesCoreService(
      repository,
      companyProfileRepo,
      r2Service,
      bankTransactionsCoreService,
      notificationsService,
      accountingCoreService,
    );
  });

  describe('postInvoice', () => {
    it('creates journal entry with correct reference, description, and documentDate', async () => {
      const mockInvoice = {
        id: 'inv-1',
        invoiceNo: '0000174',
        serialNo: 'C26TAA',
        invoiceDate: '2026-07-05',
        direction: 'IN',
        totalAmount: '1000',
        postingStatus: 'UNPOSTED',
        branchId: 'branch-1',
      };
      repository.findOne.mockResolvedValue(mockInvoice);

      const dto = {
        postingDate: '2026-07-17',
        description: 'Mua NVL',
        lines: [
          { accountId: '152', debit: 1000, credit: 0 },
          { accountId: '331', debit: 0, credit: 1000 },
        ],
      };

      const result = await service.postInvoice('inv-1', dto);

      expect(accountingCoreService.createJournalEntry).toHaveBeenCalledWith(
        expect.objectContaining({
          reference: '0000174-C26TAA',
          documentDate: new Date('2026-07-05'),
          description: '0000174-C26TAA_Mua NVL',
        }),
      );
      expect(result.postingStatus).toBe('POSTED');
      expect(result.journalEntryId).toBe('je-123');
    });

    it('sets reference without serialNo if empty', async () => {
      const mockInvoice = {
        id: 'inv-1',
        invoiceNo: '0000174',
        serialNo: null,
        invoiceDate: '2026-07-05',
        totalAmount: '1000',
        postingStatus: 'UNPOSTED',
        branchId: 'branch-1',
      };
      repository.findOne.mockResolvedValue(mockInvoice);

      await service.postInvoice('inv-1', {
        postingDate: '2026-07-17',
        lines: [
          { accountId: '152', debit: 1000, credit: 0 },
          { accountId: '331', debit: 0, credit: 1000 },
        ],
      });

      expect(accountingCoreService.createJournalEntry).toHaveBeenCalledWith(
        expect.objectContaining({
          reference: '0000174',
        }),
      );
    });

    it('throws BadRequestException if total debit != invoice total', async () => {
      const mockInvoice = {
        id: 'inv-1',
        totalAmount: '1000',
        postingStatus: 'UNPOSTED',
        branchId: 'branch-1',
      };
      repository.findOne.mockResolvedValue(mockInvoice);

      await expect(
        service.postInvoice('inv-1', {
          postingDate: '2026-07-17',
          lines: [{ accountId: '152', debit: 500, credit: 500 }],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException if invoice already POSTED', async () => {
      repository.findOne.mockResolvedValue({
        postingStatus: 'POSTED',
        branchId: 'branch-1',
      });
      await expect(
        service.postInvoice('inv-1', { postingDate: '2026-07-17', lines: [] }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('unpostInvoice', () => {
    it('calls deleteJournalEntryBySource and sets status to UNPOSTED', async () => {
      const mockInvoice = {
        id: 'inv-1',
        postingStatus: 'POSTED',
        postingDate: '2026-07-17',
        journalEntryId: 'je-123',
      };
      repository.findOne.mockResolvedValue(mockInvoice);

      const result = await service.unpostInvoice('inv-1');

      expect(
        accountingCoreService.deleteJournalEntryBySource,
      ).toHaveBeenCalledWith('inv-1', 'INVOICE');
      expect(result.postingStatus).toBe('UNPOSTED');
      expect(result.postingDate).toBeNull();
      expect(result.journalEntryId).toBeNull();
    });

    it('throws BadRequestException if invoice is not POSTED', async () => {
      repository.findOne.mockResolvedValue({ postingStatus: 'UNPOSTED' });
      await expect(service.unpostInvoice('inv-1')).rejects.toThrow(
        BadRequestException,
      );
    });
    describe('setInvoiceValid', () => {
      it('sets isValid=true, validatedAt, and validatedBy', async () => {
        const mockInvoice = { id: 'inv-1', isDeleted: false };
        repository.findOne.mockResolvedValue(mockInvoice);

        await service.setInvoiceValid('inv-1', true, 'user-1');

        expect(mockInvoice).toMatchObject({
          isValid: true,
          validatedBy: 'user-1',
        });
        expect(mockInvoice).toHaveProperty('validatedAt');
        expect(repository.save).toHaveBeenCalledWith(mockInvoice);
      });

      it('clears validatedAt and validatedBy when isValid=false', async () => {
        const mockInvoice = {
          id: 'inv-1',
          isDeleted: false,
          isValid: true,
          validatedBy: 'user-1',
          validatedAt: new Date(),
        };
        repository.findOne.mockResolvedValue(mockInvoice);

        await service.setInvoiceValid('inv-1', false, 'user-1');

        expect(mockInvoice).toMatchObject({
          isValid: false,
          validatedBy: null,
          validatedAt: null,
        });
        expect(repository.save).toHaveBeenCalledWith(mockInvoice);
      });

      it('throws NotFoundException if invoice not found', async () => {
        repository.findOne.mockResolvedValue(null);
        await expect(
          service.setInvoiceValid('inv-1', true, 'user-1'),
        ).rejects.toThrow(NotFoundException);
      });
    });

    describe('checkTokenValid', () => {
      beforeEach(() => {
        global.fetch = jest.fn();
      });

      it('returns false if token is empty', async () => {
        expect(await service.checkTokenValid('')).toBe(false);
      });

      it('returns true if GDT returns 200', async () => {
        (global.fetch as jest.Mock).mockResolvedValue({ status: 200 });
        expect(await service.checkTokenValid('valid')).toBe(true);
      });

      it('returns false if GDT returns 401', async () => {
        (global.fetch as jest.Mock).mockResolvedValue({ status: 401 });
        expect(await service.checkTokenValid('invalid')).toBe(false);
      });

      it('returns false if fetch throws error', async () => {
        (global.fetch as jest.Mock).mockRejectedValue(
          new Error('Network error'),
        );
        expect(await service.checkTokenValid('invalid')).toBe(false);
      });
    });
  });
});
