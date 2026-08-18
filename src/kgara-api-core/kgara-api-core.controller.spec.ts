import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { KgaraApiCoreController } from './kgara-api-core.controller';
import { KgaraBranch } from './entities/kgara_branch.entity';
import { KgaraCase } from './entities/kgara_case.entity';
import { KgaraReceivable } from './entities/kgara_receivable.entity';
import { KgaraPayable } from './entities/kgara_payable.entity';
import { KgaraCaseService } from './entities/kgara_case_service.entity';
import { KgaraCaseLinkedInvoice } from './entities/kgara_case_linked_invoice.entity';
import { GwSyncRun } from './entities/kgara_sync_run.entity';
import { KgaraGrossProfit } from './entities/kgara_gross_profit.entity';
import { KgaraCaseSettlement } from './entities/kgara_case_settlement.entity';
import { KgaraSyncService } from './kgara-sync.service';
import { KgaraClientService } from './kgara-client.service';
import { DocumentTraceabilityService } from '../common/services/document-traceability.service';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CoreRbacGuard } from '../auth/guards/core-rbac.guard';

describe('KgaraApiCoreController (Bidirectional Netoff & Financials)', () => {
  let controller: KgaraApiCoreController;
  let caseRepo: any;
  let linkedInvoiceRepo: any;
  let settlementRepo: any;
  let grossProfitRepo: any;

  beforeEach(async () => {
    const mockRepo = () => ({
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn().mockImplementation((e) => e),
      save: jest
        .fn()
        .mockImplementation((e) => Promise.resolve({ id: 'saved-id', ...e })),
      delete: jest.fn().mockResolvedValue({ affected: 1 }),
      query: jest.fn(),
      manager: {
        query: jest.fn(),
      },
    });

    caseRepo = mockRepo();
    linkedInvoiceRepo = mockRepo();
    settlementRepo = mockRepo();
    grossProfitRepo = mockRepo();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [KgaraApiCoreController],
      providers: [
        { provide: getRepositoryToken(KgaraBranch), useValue: mockRepo() },
        { provide: getRepositoryToken(KgaraCase), useValue: caseRepo },
        { provide: getRepositoryToken(KgaraReceivable), useValue: mockRepo() },
        { provide: getRepositoryToken(KgaraPayable), useValue: mockRepo() },
        { provide: getRepositoryToken(KgaraCaseService), useValue: mockRepo() },
        {
          provide: getRepositoryToken(KgaraCaseLinkedInvoice),
          useValue: linkedInvoiceRepo,
        },
        { provide: getRepositoryToken(GwSyncRun), useValue: mockRepo() },
        {
          provide: getRepositoryToken(KgaraGrossProfit),
          useValue: grossProfitRepo,
        },
        {
          provide: getRepositoryToken(KgaraCaseSettlement),
          useValue: settlementRepo,
        },
        { provide: KgaraSyncService, useValue: {} },
        { provide: KgaraClientService, useValue: {} },
        { provide: DocumentTraceabilityService, useValue: {} },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(CoreRbacGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<KgaraApiCoreController>(KgaraApiCoreController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getLinkedInvoices', () => {
    it('should query linked invoices with totalAmount and direction', async () => {
      linkedInvoiceRepo.query.mockResolvedValue([
        {
          id: 'link-1',
          invoiceId: 'inv-1',
          invoiceNo: '1646',
          direction: 'IN',
          totalAmount: '6300000',
          sellerName: 'HAPS',
        },
      ]);

      const res = await controller.getLinkedInvoices('case-1');
      expect(res).toHaveLength(1);
      expect(res[0].totalAmount).toBe('6300000');
      expect(linkedInvoiceRepo.query).toHaveBeenCalledWith(
        expect.stringContaining('i.total_amount as "totalAmount"'),
        ['case-1'],
      );
    });
  });

  describe('getCaseFinancialSummary', () => {
    it('should compute financial summary based strictly on cashflow settlements', async () => {
      caseRepo.findOne.mockResolvedValue({
        id: 'case-1',
        soChungTu: 'GR-001',
        tinhTrangDichVu: 3,
        tienCoThue: 10000000,
        chiPhi: 6300000,
      });
      grossProfitRepo.findOne.mockResolvedValue(null);

      settlementRepo.find.mockResolvedValue([
        {
          id: 'set-1',
          settlementType: 'PAYMENT',
          sourceChannel: 'ON_SYSTEM',
          amount: '1279293',
        },
      ]);

      const res = await controller.getCaseFinancialSummary('case-1');
      expect(res.breakdown.payments.directPaymentOnSystem).toBe(1279293);
      expect(res.breakdown.payments.totalPaid).toBe(1279293);
      expect(res.breakdown.payments.remainingPayable).toBe(6300000 - 1279293);
    });
  });

  describe('addCaseSettlement', () => {
    it('should auto-sync ON_SYSTEM settlement into erp_invoice_voucher_netoff for linked invoices', async () => {
      linkedInvoiceRepo.query.mockResolvedValue([
        { id: 'inv-1', totalAmount: '6300000' },
      ]);
      settlementRepo.manager.query
        .mockResolvedValueOnce([]) // no existing net-off
        .mockResolvedValueOnce([]); // insert success

      const res = await controller.addCaseSettlement('case-1', {
        bankTransactionId: 'txn-1',
        settlementType: 'PAYMENT',
        sourceChannel: 'ON_SYSTEM',
        amount: 6300000,
      });

      expect(res.id).toBe('saved-id');
      expect(settlementRepo.manager.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO erp_invoice_voucher_netoff'),
        expect.arrayContaining(['inv-1', 'txn-1', 6300000]),
      );
    });
  });

  describe('removeCaseSettlement', () => {
    it('should auto-clean invoice netoff when ON_SYSTEM settlement is removed', async () => {
      settlementRepo.findOne.mockResolvedValue({
        id: 'set-1',
        caseId: 'case-1',
        bankTransactionId: 'txn-1',
      });
      linkedInvoiceRepo.query.mockResolvedValue([{ id: 'inv-1' }]);
      settlementRepo.manager.query.mockResolvedValue([]);

      const res = await controller.removeCaseSettlement('case-1', 'set-1');
      expect(res.success).toBe(true);
      expect(settlementRepo.manager.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM erp_invoice_voucher_netoff'),
        ['txn-1', ['inv-1']],
      );
    });
  });
});
