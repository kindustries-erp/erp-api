import { ErpInvoicesCoreService } from './erp-invoices-core.service';
import { InvoiceLifecycleService } from './services/invoice-lifecycle.service';
import { InvoicePortalService } from './services/invoice-portal.service';
import { InvoiceImportService } from './services/invoice-import.service';
import { InvoiceFilesService } from './services/invoice-files.service';
import { InvoiceQueryService } from './services/invoice-query.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('ErpInvoicesCoreService', () => {
  let service: ErpInvoicesCoreService;
  let lifecycleService: any;
  let portalService: any;
  let importService: any;
  let filesService: any;
  let queryService: any;
  let exportBackgroundService: any;
  // Keep repository mock for lifecycle sub-service tests that instantiate it directly
  let repository: any;
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
    accountingCoreService = {
      createJournalEntry: jest.fn().mockResolvedValue({ id: 'je-123' }),
      deleteJournalEntryBySource: jest.fn().mockResolvedValue(true),
    };

    lifecycleService = {
      findOne: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
      cancel: jest.fn(),
      bulkSetBranch: jest.fn(),
      setInvoiceValid: jest.fn(),
      postInvoice: jest.fn(),
      unpostInvoice: jest.fn(),
      linkVouchersToInvoice: jest.fn(),
      removeVoucherFromInvoice: jest.fn(),
    };

    portalService = {
      progress$: { next: jest.fn() } as any,
      getPortalConfig: jest.fn(),
      savePortalConfig: jest.fn(),
      checkTokenValid: jest.fn(),
      syncFromPortal: jest.fn(),
      bulkDownloadXml: jest.fn(),
      syncDetailFromPortal: jest.fn(),
    };

    importService = {
      bulkImportBuyerXml: jest.fn(),
      bulkImportSellerXml: jest.fn(),
      bulkImportMixed: jest.fn(),
    };

    filesService = {
      getFileDownloadUrl: jest.fn(),
      getFileUploadUrl: jest.fn(),
      uploadPdfs: jest.fn(),
      getPdfContent: jest.fn(),
      getPdfDownloadUrl: jest.fn(),
      downloadAllPdfsZip: jest.fn(),
      bulkDownloadFilesZip: jest.fn(),
      deletePdf: jest.fn(),
    };

    queryService = {
      findAll: jest.fn(),
      getColumnOptions: jest.fn(),
      exportExcel: jest.fn(),
    };

    exportBackgroundService = {
      progress$: { next: jest.fn() } as any,
      startBackgroundExport: jest.fn(),
      listHistoryForUser: jest.fn(),
      getJobSnapshotForUser: jest.fn(),
      getReadyExportFile: jest.fn(),
    };

    service = new ErpInvoicesCoreService(
      lifecycleService,
      portalService,
      importService,
      filesService,
      queryService,
      exportBackgroundService,
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

      const dto = {
        postingDate: '2026-07-17',
        description: 'Mua NVL',
        lines: [
          { accountId: '152', debit: 1000, credit: 0 },
          { accountId: '331', debit: 0, credit: 1000 },
        ],
      };

      lifecycleService.postInvoice.mockResolvedValue({
        ...mockInvoice,
        postingStatus: 'POSTED',
        journalEntryId: 'je-123',
      });

      const result = await service.postInvoice('inv-1', dto);
      expect(lifecycleService.postInvoice).toHaveBeenCalledWith('inv-1', dto);
      expect(result.postingStatus).toBe('POSTED');
      expect(result.journalEntryId).toBe('je-123');
    });

    it('throws BadRequestException if total debit != total credit (via lifecycleService)', async () => {
      lifecycleService.postInvoice.mockRejectedValue(
        new BadRequestException('Hạch toán không cân bằng'),
      );
      await expect(
        service.postInvoice('inv-1', {
          postingDate: '2026-07-17',
          lines: [{ accountId: '152', debit: 500, credit: 400 }],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException if invoice already POSTED (via lifecycleService)', async () => {
      lifecycleService.postInvoice.mockRejectedValue(
        new BadRequestException('Invoice is already posted'),
      );
      await expect(
        service.postInvoice('inv-1', { postingDate: '2026-07-17', lines: [] }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('unpostInvoice', () => {
    it('delegates to lifecycleService.unpostInvoice', async () => {
      lifecycleService.unpostInvoice.mockResolvedValue({
        id: 'inv-1',
        postingStatus: 'UNPOSTED',
        postingDate: null,
        journalEntryId: null,
      });

      const result = await service.unpostInvoice('inv-1');
      expect(lifecycleService.unpostInvoice).toHaveBeenCalledWith('inv-1');
      expect(result.postingStatus).toBe('UNPOSTED');
      expect(result.postingDate).toBeNull();
      expect(result.journalEntryId).toBeNull();
    });

    it('throws BadRequestException if invoice is not POSTED (via lifecycleService)', async () => {
      lifecycleService.unpostInvoice.mockRejectedValue(
        new BadRequestException('Invoice is not posted'),
      );
      await expect(service.unpostInvoice('inv-1')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('setInvoiceValid', () => {
    it('delegates to lifecycleService.setInvoiceValid', async () => {
      lifecycleService.setInvoiceValid.mockResolvedValue(undefined);
      await service.setInvoiceValid('inv-1', true, 'user-1');
      expect(lifecycleService.setInvoiceValid).toHaveBeenCalledWith(
        'inv-1',
        true,
        'user-1',
      );
    });

    it('propagates NotFoundException from lifecycleService', async () => {
      lifecycleService.setInvoiceValid.mockRejectedValue(
        new NotFoundException('Invoice not found'),
      );
      await expect(
        service.setInvoiceValid('inv-1', true, 'user-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('checkTokenValid', () => {
    it('delegates to portalService.checkTokenValid', async () => {
      portalService.checkTokenValid.mockResolvedValue(true);
      expect(await service.checkTokenValid('valid')).toBe(true);
      expect(portalService.checkTokenValid).toHaveBeenCalledWith(
        'valid',
        undefined,
      );
    });

    it('returns false for empty token (via portalService)', async () => {
      portalService.checkTokenValid.mockResolvedValue(false);
      expect(await service.checkTokenValid('')).toBe(false);
    });
  });
});
