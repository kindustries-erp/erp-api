import { Test, TestingModule } from '@nestjs/testing';
import { KgaraSyncService, parseSafeDate } from './kgara-sync.service';
import { KgaraClientService } from './kgara-client.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { KgaraBranch } from './entities/kgara_branch.entity';
import { KgaraCase } from './entities/kgara_case.entity';
import { KgaraGrossProfit } from './entities/kgara_gross_profit.entity';
import { KgaraReceivable } from './entities/kgara_receivable.entity';
import { KgaraPayable } from './entities/kgara_payable.entity';
import { KgaraCaseService } from './entities/kgara_case_service.entity';
import { GwSyncRun } from './entities/kgara_sync_run.entity';
import { KgaraCaseLinkedInvoice } from './entities/kgara_case_linked_invoice.entity';
import { KgaraCaseSettlement } from './entities/kgara_case_settlement.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { SyncRunLoggerService } from './services/sync-run-logger.service';
import { SyncDeletionService } from './services/sync-deletion.service';
import { SyncGrossProfitService } from './services/sync-gross-profit.service';
import { SyncDebtService } from './services/sync-debt.service';
import { SyncCaseService } from './services/sync-case.service';

describe('KgaraSyncService', () => {
  let service: KgaraSyncService;
  let clientService: any;
  let branchRepo: any;
  let caseRepo: any;
  let receivableRepo: any;
  let payableRepo: any;
  let caseServiceRepo: any;
  let syncRunRepo: any;
  let grossProfitRepo: any;
  let linkedInvoiceRepo: any;
  let settlementRepo: any;
  let notificationsService: any;

  beforeEach(async () => {
    clientService = {
      getBranches: jest.fn(),
      getCases: jest.fn(),
      getReceivables: jest.fn(),
      getPayables: jest.fn(),
      getCaseDetail: jest.fn(),
      getGrossProfitDetail: jest
        .fn()
        .mockResolvedValue({ results: { Groups: [] } }),
    };

    const mockRepo = () => ({
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn(),
      save: jest.fn().mockImplementation((entity) => Promise.resolve(entity)),
      delete: jest.fn().mockResolvedValue({ affected: 1 }),
      upsert: jest.fn().mockResolvedValue({ identifiers: [] }),
      createQueryBuilder: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      }),
      manager: {
        transaction: jest.fn((cb) =>
          cb({
            save: jest.fn().mockImplementation((e) => Promise.resolve(e)),
          }),
        ),
      },
    });

    branchRepo = mockRepo() as any;
    caseRepo = mockRepo() as any;
    receivableRepo = mockRepo() as any;
    payableRepo = mockRepo() as any;
    caseServiceRepo = mockRepo() as any;
    syncRunRepo = mockRepo() as any;
    grossProfitRepo = mockRepo() as any;
    linkedInvoiceRepo = mockRepo() as any;
    settlementRepo = mockRepo() as any;
    notificationsService = {
      createNotification: jest.fn().mockResolvedValue({}),
      broadcast: jest.fn(),
    };

    // Add count method to linkedInvoiceRepo
    linkedInvoiceRepo.count = jest.fn();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KgaraSyncService,
        SyncRunLoggerService,
        SyncDeletionService,
        SyncGrossProfitService,
        SyncDebtService,
        SyncCaseService,
        {
          provide: KgaraClientService,
          useValue: clientService,
        },
        {
          provide: NotificationsService,
          useValue: notificationsService,
        },
        {
          provide: getRepositoryToken(KgaraBranch),
          useValue: branchRepo,
        },
        {
          provide: getRepositoryToken(KgaraCase),
          useValue: caseRepo,
        },
        {
          provide: getRepositoryToken(KgaraReceivable),
          useValue: receivableRepo,
        },
        {
          provide: getRepositoryToken(KgaraPayable),
          useValue: payableRepo,
        },
        {
          provide: getRepositoryToken(KgaraCaseService),
          useValue: caseServiceRepo,
        },
        {
          provide: getRepositoryToken(GwSyncRun),
          useValue: syncRunRepo,
        },
        {
          provide: getRepositoryToken(KgaraGrossProfit),
          useValue: grossProfitRepo,
        },
        {
          provide: getRepositoryToken(KgaraCaseLinkedInvoice),
          useValue: linkedInvoiceRepo,
        },
        {
          provide: getRepositoryToken(KgaraCaseSettlement),
          useValue: settlementRepo,
        },
      ],
    }).compile();

    service = module.get<KgaraSyncService>(KgaraSyncService);
  });

  describe('Initialization', () => {
    it('should be defined', () => {
      expect(service).toBeDefined();
    });
  });

  describe('syncBranches', () => {
    it('should sync branches successfully', async () => {
      clientService.getBranches.mockResolvedValue([
        { DonViID: 'b1', MaSo: 'BR01', TenDonVi: 'Branch 1' },
      ]);
      branchRepo.findOne.mockResolvedValue(null);

      await service.syncBranches();

      expect(clientService.getBranches).toHaveBeenCalled();
      expect(branchRepo.save).toHaveBeenCalled();
    });

    it('should handle API failure correctly', async () => {
      clientService.getBranches.mockRejectedValue(new Error('Network error'));

      await expect(service.syncBranches()).rejects.toThrow('Network error');
      expect(syncRunRepo.save).toHaveBeenCalled();
    });
  });

  describe('syncCasesForBranch', () => {
    it('should sync cases correctly with pagination', async () => {
      clientService.getCases.mockResolvedValueOnce({
        data: [
          {
            HdPhieuDichVuID: 'c1',
            SoChungTu: 'SC01',
            BienSoXe: '29A-12345',
            KhachHangCode: 'KH01',
            TenKhachHang: 'Nguyen Van A',
            TinhTrangDichVu: 3,
            TenTinhTrangDichVu: 'Hoàn tất',
            TongTienThanhToan: 1000000,
            TienDaThanhToan: 500000,
            NgayPhatSinh: '2026-05-01',
          },
        ],
        pagination: { totalPages: 1 },
        dataAsOf: '2026-05-01T12:00:00Z',
      });

      caseRepo.findOne.mockResolvedValue(null);

      await service.syncCasesForBranch('br-1');

      expect(clientService.getCases).toHaveBeenCalledWith(
        'br-1',
        undefined,
        undefined,
        undefined,
        1,
        200,
      );
      expect(caseRepo.save).toHaveBeenCalled();
      expect(syncRunRepo.save).toHaveBeenCalled();
    });

    it('should detect and soft-delete missing cases when full range is provided', async () => {
      clientService.getCases.mockResolvedValue({
        data: [{ HdPhieuDichVuID: 'c1' }],
        pagination: { totalPages: 1 },
      });

      const mockExistingCase = {
        id: 'uuid-2',
        hdPhieuDichVuId: 'c2',
        branchExternalId: 'br-1',
        kgaraDeleteCount: 1,
        kgaraDeletedAt: null,
      };

      caseRepo.createQueryBuilder.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([mockExistingCase]),
      });

      linkedInvoiceRepo.count.mockResolvedValue(0);

      const result = await service.syncCasesForBranch(
        'br-1',
        '2026-05-01',
        '2026-05-31',
      );

      expect(result.deletedCount).toBe(1);
      expect(mockExistingCase.kgaraDeleteCount).toBe(2);
      expect(mockExistingCase.kgaraDeletedAt).toBeInstanceOf(Date);
      expect(caseRepo.save).toHaveBeenCalledWith(mockExistingCase);
    });

    it('should restore previously soft-deleted cases', async () => {
      const previouslyDeletedCase = {
        hdPhieuDichVuId: 'c1',
        kgaraDeletedAt: new Date(),
        kgaraDeleteCount: 2,
      };

      clientService.getCases.mockResolvedValue({
        data: [{ HdPhieuDichVuID: 'c1', TinhTrangDichVu: 2 }],
        pagination: { totalPages: 1 },
      });

      caseRepo.findOne.mockResolvedValue(previouslyDeletedCase);

      await service.syncCasesForBranch('br-1');

      expect(previouslyDeletedCase.kgaraDeletedAt).toBeNull();
      expect(previouslyDeletedCase.kgaraDeleteCount).toBe(0);
      expect(caseRepo.save).toHaveBeenCalledWith(previouslyDeletedCase);
    });

    it('should exclude cases with classification OJ_NGOAI from soft-delete detection query', async () => {
      clientService.getCases.mockResolvedValue({
        data: [{ HdPhieuDichVuID: 'c1' }],
        pagination: { totalPages: 1 },
      });

      const andWhereMock = jest.fn().mockReturnThis();
      caseRepo.createQueryBuilder.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        andWhere: andWhereMock,
        getMany: jest.fn().mockResolvedValue([]),
      });

      await service.syncCasesForBranch('br-1', '2026-05-01', '2026-05-31');

      expect(andWhereMock).toHaveBeenCalledWith(
        '(case.classification != :ojNgoai OR case.classification IS NULL)',
        { ojNgoai: 'OJ_NGOAI' },
      );
    });
  });

  describe('syncReceivables', () => {
    it('should sync receivables correctly', async () => {
      clientService.getReceivables.mockResolvedValue({
        data: [
          {
            HdPhieuDichVuID: 'c1',
            SoChungTu: 'SC01',
            TienThanhToan: 1000000,
            TienDaThanhToan: 500000,
          },
        ],
        pagination: { totalPages: 1 },
      });

      receivableRepo.findOne.mockResolvedValue(null);

      await service.syncReceivables('br-1');

      expect(clientService.getReceivables).toHaveBeenCalled();
      expect(receivableRepo.save).toHaveBeenCalled();
    });
  });

  describe('syncPayables', () => {
    it('should sync payables correctly', async () => {
      clientService.getPayables.mockResolvedValue({
        results: {
          data: [
            {
              TaiKhoanID: 'tk-1',
              DoiTacID: 'dt-1',
              MaSoTaiKhoan: '331',
              TenDoiTac: 'Nha Cung Cap A',
              DKNo: 0,
              DKCo: 1000000,
              PSNo: 500000,
              PSCo: 0,
              CKNo: 0,
              CKCo: 500000,
            },
          ],
          pagination: { totalPages: 1 },
        },
      });

      payableRepo.findOne.mockResolvedValue(null);

      await service.syncPayables('br-1');

      expect(clientService.getPayables).toHaveBeenCalled();
      expect(payableRepo.save).toHaveBeenCalled();
    });
  });

  describe('parseSafeDate', () => {
    it('should correctly parse valid ISO strings and Date objects', () => {
      const isoStr = '2026-05-15T08:30:00.000Z';
      const parsedIso = parseSafeDate(isoStr);
      expect(parsedIso).toBeInstanceOf(Date);
      expect(parsedIso?.toISOString()).toBe(isoStr);

      const now = new Date();
      const parsedDate = parseSafeDate(now);
      expect(parsedDate?.getTime()).toBe(now.getTime());
    });

    it('should parse DD/MM/YYYY and DD/MM/YYYY HH:mm:ss format', () => {
      const dmyStr = '15/05/2026';
      const parsed = parseSafeDate(dmyStr);
      expect(parsed).toBeInstanceOf(Date);
      expect(parsed?.getFullYear()).toBe(2026);
      expect(parsed?.getMonth()).toBe(4); // May is 4
      expect(parsed?.getDate()).toBe(15);

      const dmyTimeStr = '15/05/2026 14:30:45';
      const parsedTime = parseSafeDate(dmyTimeStr);
      expect(parsedTime).toBeInstanceOf(Date);
      expect(parsedTime?.getHours()).toBe(14);
      expect(parsedTime?.getMinutes()).toBe(30);
    });

    it('should safely return null for invalid or empty dates without returning Invalid Date', () => {
      expect(parseSafeDate(null)).toBeNull();
      expect(parseSafeDate(undefined)).toBeNull();
      expect(parseSafeDate('')).toBeNull();
      expect(parseSafeDate('   ')).toBeNull();
      expect(parseSafeDate('invalid-date-string')).toBeNull();
      expect(parseSafeDate('NaN')).toBeNull();
      expect(parseSafeDate('0001-01-01T00:00:00')).toBeNull();
      expect(parseSafeDate('1900-01-01')).toBeNull();
      expect(parseSafeDate(new Date('invalid'))).toBeNull();
    });
  });

  describe('syncCasesForBranch with malformed date fields', () => {
    it('should handle malformed date fields from KGara without throwing or storing NaN', async () => {
      clientService.getCases.mockResolvedValue({
        data: [
          {
            HdPhieuDichVuID: 'c-corrupted-date',
            SoChungTu: 'SC-CORRUPT',
            NgayPhatSinh: 'invalid-date-text',
            NgayPhatSinhFull: '',
            NgayTiepNhan: null,
            NgayHoanThanhCongViec: '0001-01-01T00:00:00',
            NgayGiaoXeFull: undefined,
            TinhTrangDichVu: 3,
            TongTienThanhToan: 2000000,
          },
        ],
        pagination: { totalPages: 1 },
      });

      caseRepo.findOne.mockResolvedValue(null);

      await service.syncCasesForBranch('br-1');

      expect(caseRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          hdPhieuDichVuId: 'c-corrupted-date',
          ngayPhatSinh: null,
          ngayTiepNhan: null,
          ngayHoanThanhCongViec: null,
          ngayGiaoXeFull: null,
        }),
      );
    });
  });

  describe('Preservation of ERP internal fields during sync', () => {
    it('should preserve classification and erpNotes when syncing cases for branch', async () => {
      const existingCaseWithErpData = {
        id: 'uuid-123',
        hdPhieuDichVuId: 'c-preserve-1',
        classification: 'KY_GUI_NOI_BO',
        erpNotes: 'Ghi chú nghiệp vụ quan trọng',
        tinhTrangDichVu: 2,
      };

      clientService.getCases.mockResolvedValue({
        data: [
          {
            HdPhieuDichVuID: 'c-preserve-1',
            SoChungTu: 'SC-01',
            TinhTrangDichVu: 3,
            TongTienThanhToan: 5000000,
          },
        ],
        pagination: { totalPages: 1 },
      });

      caseRepo.findOne.mockResolvedValue(existingCaseWithErpData);

      await service.syncCasesForBranch('br-1');

      expect(caseRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          hdPhieuDichVuId: 'c-preserve-1',
          classification: 'KY_GUI_NOI_BO',
          erpNotes: 'Ghi chú nghiệp vụ quan trọng',
          tinhTrangDichVu: 3,
        }),
      );
    });

    it('should preserve classification and erpNotes when syncing case detail', async () => {
      const existingCaseWithErpData = {
        id: 'uuid-456',
        hdPhieuDichVuId: 'c-preserve-2',
        classification: 'SUA_CHUA_CHUNG',
        erpNotes: 'Khách VIP garage',
        tinhTrangDichVu: 1,
      };

      clientService.getCaseDetail.mockResolvedValue({
        data: {
          HdPhieuDichVuID: 'c-preserve-2',
          SoChungTu: 'SC-02',
          TinhTrangDichVu: 2,
          TongTienThanhToan: 3000000,
          ListPhieuDichVuChiTiet: [],
        },
      });

      caseRepo.findOne.mockResolvedValue(existingCaseWithErpData);

      await service.syncCaseDetail('br-1', 'c-preserve-2');

      expect(caseRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          hdPhieuDichVuId: 'c-preserve-2',
          classification: 'SUA_CHUA_CHUNG',
          erpNotes: 'Khách VIP garage',
          tinhTrangDichVu: 2,
        }),
      );
    });
  });
});
