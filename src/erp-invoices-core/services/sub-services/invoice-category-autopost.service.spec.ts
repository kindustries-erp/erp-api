import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { InvoiceCategoryAutopostService } from './invoice-category-autopost.service';
import { ErpInvoice } from '../../entities/erp_invoice.entity';
import { ErpModuleCategory } from '../../../module-config/entities/erp_module_category.entity';
import { ErpChartOfAccount } from '../../../accounting-core/entities/erp_chart_of_account.entity';
import { ErpJournalEntry } from '../../../accounting-core/entities/erp_journal_entry.entity';
import { ErpJournalEntryLine } from '../../../accounting-core/entities/erp_journal_entry_line.entity';
import { AccountingCoreService } from '../../../accounting-core/services/accounting-core.service';
import { InvoiceAiHandler } from '../../../ai-hub-core/handlers/invoice-ai.handler';

describe('InvoiceCategoryAutopostService', () => {
  let service: InvoiceCategoryAutopostService;
  let mockInvoiceRepo: any;
  let mockCategoryRepo: any;
  let mockCoaRepo: any;
  let mockJeRepo: any;
  let mockJeLineRepo: any;
  let mockAccountingService: any;
  let mockInvoiceAiHandler: any;

  const mockCoaList = [
    {
      id: 'coa-1561',
      accountCode: '1561',
      accountName: 'Hàng hóa VinFast',
      isActive: true,
      isDeleted: false,
    },
    {
      id: 'coa-1563',
      accountCode: '1563',
      accountName: 'Phụ tùng OEM',
      isActive: true,
      isDeleted: false,
    },
    {
      id: 'coa-6427',
      accountCode: '6427',
      accountName: 'CP DV mua ngoài',
      isActive: true,
      isDeleted: false,
    },
    {
      id: 'coa-152',
      accountCode: '152',
      accountName: 'Nguyên vật liệu',
      isActive: true,
      isDeleted: false,
    },
    {
      id: 'coa-632',
      accountCode: '632',
      accountName: 'Giá vốn',
      isActive: true,
      isDeleted: false,
    },
    {
      id: 'coa-1331',
      accountCode: '1331',
      accountName: 'Thuế GTGT',
      isActive: true,
      isDeleted: false,
    },
    {
      id: 'coa-331',
      accountCode: '331',
      accountName: 'Phải trả người bán',
      isActive: true,
      isDeleted: false,
    },
    {
      id: 'coa-t0003',
      accountCode: 'T0003',
      accountName: 'Treo chờ xử lý HĐ mua',
      isActive: true,
      isDeleted: false,
    },
  ];

  beforeEach(async () => {
    mockInvoiceRepo = {
      findOne: jest.fn(),
      save: jest.fn().mockImplementation((inv) => Promise.resolve(inv)),
      manager: {
        query: jest.fn().mockResolvedValue([{ id: 'branch-1' }]),
      },
    };

    mockCategoryRepo = {
      findOne: jest.fn(),
    };

    mockCoaRepo = {
      find: jest.fn().mockResolvedValue(mockCoaList),
    };

    mockJeRepo = {
      findOne: jest.fn(),
    };

    mockJeLineRepo = {
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    };

    mockAccountingService = {
      createJournalEntry: jest
        .fn()
        .mockResolvedValue({ id: 'je-1', entryNo: 'HĐM-20260925-01' }),
    };

    mockInvoiceAiHandler = {
      classifyInvoiceCategory: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InvoiceCategoryAutopostService,
        { provide: getRepositoryToken(ErpInvoice), useValue: mockInvoiceRepo },
        {
          provide: getRepositoryToken(ErpModuleCategory),
          useValue: mockCategoryRepo,
        },
        {
          provide: getRepositoryToken(ErpChartOfAccount),
          useValue: mockCoaRepo,
        },
        { provide: getRepositoryToken(ErpJournalEntry), useValue: mockJeRepo },
        {
          provide: getRepositoryToken(ErpJournalEntryLine),
          useValue: mockJeLineRepo,
        },
        { provide: AccountingCoreService, useValue: mockAccountingService },
        { provide: InvoiceAiHandler, useValue: mockInvoiceAiHandler },
      ],
    }).compile();

    service = module.get<InvoiceCategoryAutopostService>(
      InvoiceCategoryAutopostService,
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should create new Journal Entry with Debit 1561, Debit 1331, Credit 331 for VF_PARTS', async () => {
    mockInvoiceRepo.findOne.mockResolvedValue({
      id: 'inv-1',
      invoiceNo: '1234',
      direction: 'IN',
      branchId: 'branch-1',
      preVatAmount: '1000000',
      vatAmount: '100000',
      totalAmount: '1100000',
      postingStatus: 'UNPOSTED',
      invoiceDate: '2026-09-25',
      sellerName: 'VinFast',
    });

    const result = await service.autoPostInvoiceByCategory('inv-1', 'VF_PARTS');

    expect(result.postingStatus).toBe('POSTED');
    expect(mockAccountingService.createJournalEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        branchId: 'branch-1',
        lines: [
          expect.objectContaining({
            accountId: 'coa-1561',
            debit: 1000000,
            credit: 0,
          }),
          expect.objectContaining({
            accountId: 'coa-1331',
            debit: 100000,
            credit: 0,
          }),
          expect.objectContaining({
            accountId: 'coa-331',
            debit: 0,
            credit: 1100000,
          }),
        ],
      }),
    );
  });

  it('should fallback to Debit T0003 when category is null or unknown', async () => {
    mockInvoiceRepo.findOne.mockResolvedValue({
      id: 'inv-2',
      invoiceNo: '5678',
      direction: 'IN',
      branchId: 'branch-1',
      preVatAmount: '500000',
      vatAmount: '50000',
      totalAmount: '550000',
      postingStatus: 'UNPOSTED',
      invoiceDate: '2026-09-25',
    });

    await service.autoPostInvoiceByCategory('inv-2', null);

    expect(mockAccountingService.createJournalEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        lines: expect.arrayContaining([
          expect.objectContaining({ accountId: 'coa-t0003' }),
        ]),
      }),
    );
  });

  it('should perform In-Place update on existing Journal Entry when invoice is already POSTED', async () => {
    mockInvoiceRepo.findOne.mockResolvedValue({
      id: 'inv-3',
      invoiceNo: '9999',
      direction: 'IN',
      postingStatus: 'POSTED',
      journalEntryId: 'je-old-1',
    });

    mockJeRepo.findOne.mockResolvedValue({
      id: 'je-old-1',
      entryNo: 'HĐM-20260718-10',
      lines: [
        {
          id: 'line-debit-1',
          accountId: 'coa-t0003',
          debit: '1000000',
          credit: '0',
          account: { accountCode: 'T0003' },
        },
        {
          id: 'line-vat-1',
          accountId: 'coa-1331',
          debit: '100000',
          credit: '0',
          account: { accountCode: '1331' },
        },
        {
          id: 'line-credit-1',
          accountId: 'coa-331',
          debit: '0',
          credit: '1100000',
          account: { accountCode: '331' },
        },
      ],
    });

    await service.autoPostInvoiceByCategory('inv-3', 'OPEX_LOGISTICS');

    // Should update debit line from T0003 to 6427 (coa-6427)
    expect(mockJeLineRepo.update).toHaveBeenCalledWith('line-debit-1', {
      accountId: 'coa-6427',
    });
    // Credit line 331 should NOT be updated
    expect(mockJeLineRepo.update).not.toHaveBeenCalledWith(
      'line-credit-1',
      expect.anything(),
    );
    // Should NOT create new JE
    expect(mockAccountingService.createJournalEntry).not.toHaveBeenCalled();
  });

  it('should call AI in classifyAndAutoPost and set category correctly', async () => {
    mockInvoiceRepo.findOne.mockResolvedValue({
      id: 'inv-4',
      invoiceNo: '503887',
      sellerTaxCode: '0312650437',
      sellerName: 'GRAB',
      totalAmount: '65000',
      postingStatus: 'UNPOSTED',
      branchId: 'branch-1',
    });

    mockInvoiceAiHandler.classifyInvoiceCategory.mockResolvedValue({
      categoryCode: 'OPEX_LOGISTICS',
      confidence: 0.95,
      reason: 'Grab shipping fee',
    });

    mockCategoryRepo.findOne.mockResolvedValue({
      id: 'cat-grab',
      code: 'OPEX_LOGISTICS',
    });

    const res = await service.classifyAndAutoPost('inv-4');

    expect(res.categoryCode).toBe('OPEX_LOGISTICS');
    expect(res.isFallback).toBe(false);
    expect(mockInvoiceRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ categoryId: 'cat-grab' }),
    );
  });
});
