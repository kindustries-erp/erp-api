import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { InvoiceCategoryAutopostService } from './invoice-category-autopost.service';
import { ErpInvoice } from '../../entities/erp_invoice.entity';
import { ErpModuleCategory } from '../../../module-config/entities/erp_module_category.entity';
import { ErpModuleAttributeDef } from '../../../module-config/entities/erp_module_attribute_def.entity';
import { ErpChartOfAccount } from '../../../accounting-core/entities/erp_chart_of_account.entity';
import { ErpJournalEntry } from '../../../accounting-core/entities/erp_journal_entry.entity';
import { ErpJournalEntryLine } from '../../../accounting-core/entities/erp_journal_entry_line.entity';
import { AccountingCoreService } from '../../../accounting-core/services/accounting-core.service';
import { InvoiceCategoryMemoryService } from './invoice-category-memory.service';
import { InvoiceAiHandler } from '../../../ai-hub-core/handlers/invoice-ai.handler';

describe('InvoiceCategoryAutopostService', () => {
  let service: InvoiceCategoryAutopostService;
  let mockInvoiceRepo: any;
  let mockCategoryRepo: any;
  let mockAttrDefRepo: any;
  let mockCoaRepo: any;
  let mockJeRepo: any;
  let mockJeLineRepo: any;
  let mockAccountingService: any;
  let mockInvoiceAiHandler: any;
  let mockCategoryMemory: { recall: jest.Mock };

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

    mockAttrDefRepo = {
      find: jest.fn().mockResolvedValue([]),
    };

    mockCoaRepo = {
      find: jest.fn().mockResolvedValue(mockCoaList),
    };

    mockJeRepo = {
      findOne: jest.fn(),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    };

    mockJeLineRepo = {
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    };

    mockAccountingService = {
      createJournalEntry: jest
        .fn()
        .mockResolvedValue({ id: 'je-1', entryNo: 'HĐM-20260925-0001' }),
      generateEntryNo: jest.fn().mockResolvedValue('HĐM-20260925-0001'),
    };

    mockInvoiceAiHandler = {
      classifyInvoiceCategory: jest.fn(),
    };

    mockCategoryMemory = { recall: jest.fn().mockResolvedValue(null) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InvoiceCategoryAutopostService,
        { provide: getRepositoryToken(ErpInvoice), useValue: mockInvoiceRepo },
        {
          provide: getRepositoryToken(ErpModuleCategory),
          useValue: mockCategoryRepo,
        },
        {
          provide: getRepositoryToken(ErpModuleAttributeDef),
          useValue: mockAttrDefRepo,
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
        { provide: InvoiceCategoryMemoryService, useValue: mockCategoryMemory },
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
    // Should upgrade legacy entryNo to standardized format
    expect(mockJeRepo.update).toHaveBeenCalledWith(
      'je-old-1',
      expect.objectContaining({
        entryNo: 'HĐM-20260925-0001',
      }),
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

  it('should use overrideDebitAccountCode configured in ErpModuleAttributeDef options', async () => {
    mockInvoiceRepo.findOne.mockResolvedValue({
      id: 'inv-5',
      invoiceNo: '8888',
      direction: 'IN',
      branchId: 'branch-1',
      preVatAmount: '2000000',
      vatAmount: '200000',
      totalAmount: '2200000',
      postingStatus: 'UNPOSTED',
      invoiceDate: '2026-09-25',
    });

    // Mock ErpModuleAttributeDef có option CUSTOM_PARTS với accountCode: '1563'
    mockAttrDefRepo.find.mockResolvedValue([
      {
        id: 'attr-cat-1',
        code: 'category',
        options: [
          {
            value: 'CUSTOM_PARTS',
            label: 'Linh kiện tùy chỉnh',
            accountCode: '1563',
          },
        ],
      },
    ]);

    const result = await service.autoPostInvoiceByCategory(
      'inv-5',
      'CUSTOM_PARTS',
    );

    expect(result.postingStatus).toBe('POSTED');
    expect(mockAccountingService.createJournalEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        branchId: 'branch-1',
        lines: expect.arrayContaining([
          expect.objectContaining({
            accountId: 'coa-1563',
            debit: 2000000,
            credit: 0,
          }),
        ]),
      }),
    );
  });

  describe('T0003 fallback marker', () => {
    const unposted = (id: string) => ({
      id,
      invoiceNo: '777',
      serialNo: 'C26TAA',
      direction: 'IN',
      branchId: 'branch-1',
      preVatAmount: '100000',
      vatAmount: '10000',
      totalAmount: '110000',
      postingStatus: 'UNPOSTED',
      invoiceDate: '2026-09-25',
      description: 'Mua hàng',
    });

    it('appends [T0003_FALLBACK] to the journal description when posting to T0003', async () => {
      mockInvoiceRepo.findOne.mockResolvedValue(unposted('inv-m1'));
      await service.autoPostInvoiceByCategory('inv-m1', null);
      const arg = mockAccountingService.createJournalEntry.mock.calls[0][0];
      expect(arg.description).toBe('777-C26TAA_Mua hàng [T0003_FALLBACK]');
    });

    it('includes the reason when provided', async () => {
      mockInvoiceRepo.findOne.mockResolvedValue(unposted('inv-m2'));
      await service.autoPostInvoiceByCategory('inv-m2', null, {
        fallbackReason: 'AI_ERROR',
      });
      const arg = mockAccountingService.createJournalEntry.mock.calls[0][0];
      expect(arg.description).toContain('[T0003_FALLBACK:AI_ERROR]');
    });

    it('does not add a marker when a category resolves a real account', async () => {
      mockInvoiceRepo.findOne.mockResolvedValue(unposted('inv-m3'));
      await service.autoPostInvoiceByCategory('inv-m3', 'VF_PARTS', {
        fallbackReason: 'AI_ERROR',
      });
      const arg = mockAccountingService.createJournalEntry.mock.calls[0][0];
      expect(arg.description).not.toContain('T0003_FALLBACK');
    });

    it('classifyAndAutoPost passes the AI fallbackReason into the posting', async () => {
      mockInvoiceRepo.findOne.mockResolvedValue(unposted('inv-m4'));
      mockInvoiceAiHandler.classifyInvoiceCategory.mockResolvedValue({
        categoryCode: null,
        confidence: 0,
        reason: 'AI Failure: timeout',
        fallbackReason: 'AI_ERROR',
      });

      const res = await service.classifyAndAutoPost('inv-m4');

      expect(res.isFallback).toBe(true);
      expect(res.fallbackReason).toBe('AI_ERROR');
      const arg = mockAccountingService.createJournalEntry.mock.calls[0][0];
      expect(arg.description).toContain('[T0003_FALLBACK:AI_ERROR]');
    });

    it('strips the old marker from an existing journal entry once a real category is set', async () => {
      mockInvoiceRepo.findOne.mockResolvedValue({
        id: 'inv-m5',
        invoiceNo: '777',
        direction: 'IN',
        postingStatus: 'POSTED',
        journalEntryId: 'je-m5',
      });
      mockJeRepo.findOne.mockResolvedValue({
        id: 'je-m5',
        entryNo: 'HĐM-20260925-0007',
        reference: '777',
        sourceId: 'inv-m5',
        sourceType: 'INVOICE',
        description: '777_Mua hàng [T0003_FALLBACK:AI_ERROR]',
        lines: [
          {
            id: 'l1',
            accountId: 'coa-t0003',
            debit: '100000',
            credit: '0',
            account: { accountCode: 'T0003' },
          },
        ],
      });

      await service.autoPostInvoiceByCategory('inv-m5', 'OPEX_LOGISTICS');

      expect(mockJeRepo.update).toHaveBeenCalledWith(
        'je-m5',
        expect.objectContaining({ description: '777_Mua hàng' }),
      );
    });
  });

  describe('batch helpers', () => {
    const unposted = {
      id: 'inv-b1',
      invoiceNo: '42',
      direction: 'IN',
      branchId: 'branch-1',
      preVatAmount: '100000',
      vatAmount: '10000',
      totalAmount: '110000',
      postingStatus: 'UNPOSTED',
      invoiceDate: '2026-09-25',
      sellerName: 'Grab',
      items: [{ description: 'Cước Grab', quantity: 1, totalAmount: 110000 }],
    };

    it('classifyInvoiceOnly calls the AI with items and does not write', async () => {
      mockInvoiceRepo.findOne.mockResolvedValue(unposted);
      mockInvoiceAiHandler.classifyInvoiceCategory.mockResolvedValue({
        categoryCode: 'OPEX_LOGISTICS',
        confidence: 0.9,
        reason: 'ok',
      });

      const res = await service.classifyInvoiceOnly('inv-b1');

      expect(res.categoryCode).toBe('OPEX_LOGISTICS');
      expect(mockInvoiceAiHandler.classifyInvoiceCategory).toHaveBeenCalledWith(
        expect.objectContaining({
          invoiceNo: '42',
          items: [expect.objectContaining({ description: 'Cước Grab' })],
        }),
        'low',
        undefined,
      );
      expect(mockInvoiceRepo.save).not.toHaveBeenCalled();
      expect(mockAccountingService.createJournalEntry).not.toHaveBeenCalled();
    });

    it('classifyInvoiceOnly forwards a model override to the AI handler', async () => {
      mockInvoiceRepo.findOne.mockResolvedValue(unposted);
      mockInvoiceAiHandler.classifyInvoiceCategory.mockResolvedValue({
        categoryCode: null,
        confidence: 0,
        reason: 'x',
      });

      await service.classifyInvoiceOnly('inv-b1', 'ag/gemini-3.8-flash-low');

      expect(mockInvoiceAiHandler.classifyInvoiceCategory).toHaveBeenCalledWith(
        expect.any(Object),
        'low',
        'ag/gemini-3.8-flash-low',
      );
    });

    it('classifyAndAutoPost skips the AI when a preClassified result is given', async () => {
      mockInvoiceRepo.findOne.mockResolvedValue({ ...unposted });
      mockCategoryRepo.findOne.mockResolvedValue({
        id: 'cat-log',
        code: 'OPEX_LOGISTICS',
      });

      const res = await service.classifyAndAutoPost('inv-b1', {
        categoryCode: 'OPEX_LOGISTICS',
        confidence: 0.9,
        reason: 'pre',
      });

      expect(
        mockInvoiceAiHandler.classifyInvoiceCategory,
      ).not.toHaveBeenCalled();
      expect(res.categoryCode).toBe('OPEX_LOGISTICS');
      expect(res.reason).toBe('pre');
    });
  });

  describe('seller memory', () => {
    const inv = {
      id: 'inv-mem',
      invoiceNo: '9',
      direction: 'IN',
      branchId: 'branch-1',
      sellerTaxCode: '0312650437',
      preVatAmount: '100000',
      vatAmount: '10000',
      totalAmount: '110000',
      postingStatus: 'UNPOSTED',
      invoiceDate: '2026-09-25',
      items: [],
    };

    it('uses the remembered category and skips the AI', async () => {
      mockInvoiceRepo.findOne.mockResolvedValue({ ...inv });
      mockCategoryMemory.recall.mockResolvedValue({
        categoryCode: 'OPEX_LOGISTICS',
        confidence: 0.95,
        reason: 'Theo lịch sử',
        fromMemory: true,
      });
      mockCategoryRepo.findOne.mockResolvedValue({
        id: 'cat-log',
        code: 'OPEX_LOGISTICS',
      });

      const res = await service.classifyAndAutoPost('inv-mem');

      expect(mockCategoryMemory.recall).toHaveBeenCalledWith('0312650437');
      expect(
        mockInvoiceAiHandler.classifyInvoiceCategory,
      ).not.toHaveBeenCalled();
      expect(res.categoryCode).toBe('OPEX_LOGISTICS');
    });

    it('falls through to the AI when nothing is remembered', async () => {
      mockInvoiceRepo.findOne.mockResolvedValue({ ...inv });
      mockInvoiceAiHandler.classifyInvoiceCategory.mockResolvedValue({
        categoryCode: null,
        confidence: 0,
        reason: 'x',
        fallbackReason: 'AI_ERROR',
      });

      const res = await service.classifyAndAutoPost('inv-mem');

      expect(mockInvoiceAiHandler.classifyInvoiceCategory).toHaveBeenCalled();
      expect(res.isFallback).toBe(true);
    });

    it('classifyInvoiceOnly also prefers memory', async () => {
      mockInvoiceRepo.findOne.mockResolvedValue({ ...inv });
      mockCategoryMemory.recall.mockResolvedValue({
        categoryCode: 'OPEX_ADMIN',
        confidence: 0.95,
        reason: 'mem',
        fromMemory: true,
      });
      const r = await service.classifyInvoiceOnly('inv-mem');
      expect(r.fromMemory).toBe(true);
      expect(
        mockInvoiceAiHandler.classifyInvoiceCategory,
      ).not.toHaveBeenCalled();
    });
  });
});
