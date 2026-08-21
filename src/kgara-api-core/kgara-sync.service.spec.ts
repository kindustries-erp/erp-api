import { Test, TestingModule } from '@nestjs/testing';
import { KgaraSyncService, parseSafeDate } from './kgara-sync.service';
import { KgaraClientService } from './kgara-client.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { KgaraBranch } from './entities/kgara_branch.entity';
import { KgaraCase } from './entities/kgara_case.entity';
import { KgaraGrossProfit } from './entities/kgara_gross_profit.entity';
import { KgaraReceivable } from './entities/kgara_receivable.entity';
import { KgaraPayable } from './entities/kgara_payable.entity';
import { KgaraCaseService } from './entities/kgara_case_service.entity';
import { GwSyncRun, GwSyncStatus } from './entities/kgara_sync_run.entity';
import { KgaraCaseLinkedInvoice } from './entities/kgara_case_linked_invoice.entity';

import { KgaraCaseSettlement } from './entities/kgara_case_settlement.entity';
import { NotificationsService } from '../notifications/notifications.service';

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
        { DonViID: 'br-1', MaSo: 'B1', TenDonVi: 'Branch 1', ParentID: null },
      ]);
      branchRepo.findOne.mockResolvedValue(null);

      await service.syncBranches();

      expect(clientService.getBranches).toHaveBeenCalledTimes(1);
      expect(branchRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          externalId: 'br-1',
          code: 'B1',
          name: 'Branch 1',
        }),
      );
      expect(syncRunRepo.save).toHaveBeenCalledTimes(2); // 1 for start, 1 for end
      const lastSaveCall = syncRunRepo.save.mock.calls[1][0];
      expect(lastSaveCall.status).toBe(GwSyncStatus.SUCCESS);
      expect(lastSaveCall.rowCount).toBe(1);
    });

    it('should handle API failure correctly', async () => {
      clientService.getBranches.mockRejectedValue(new Error('API Error'));

      await expect(service.syncBranches()).rejects.toThrow('API Error');

      expect(syncRunRepo.save).toHaveBeenCalledTimes(2);
      const lastSaveCall = syncRunRepo.save.mock.calls[1][0];
      expect(lastSaveCall.status).toBe(GwSyncStatus.FAILED);
      expect(lastSaveCall.errorMessage).toBe('API Error');
    });
  });

  describe('syncCasesForBranch', () => {
    it('should sync cases correctly with pagination', async () => {
      clientService.getCases
        .mockResolvedValueOnce({
          data: [{ HdPhieuDichVuID: 'case-1', SoChungTu: 'PDV-001' }],
          pagination: { totalPages: 2 },
          dataAsOf: '2026-07-27T00:00:00Z',
        })
        .mockResolvedValueOnce({
          data: [{ HdPhieuDichVuID: 'case-2', SoChungTu: 'PDV-002' }],
          pagination: { totalPages: 2 },
          dataAsOf: '2026-07-27T00:00:00Z',
        });
      caseRepo.findOne.mockResolvedValue(null);

      await service.syncCasesForBranch('br-1');

      expect(clientService.getCases).toHaveBeenCalledTimes(2);
      expect(clientService.getCases).toHaveBeenNthCalledWith(
        1,
        'br-1',
        undefined,
        undefined,
        undefined,
        1,
        200,
      );
      expect(clientService.getCases).toHaveBeenNthCalledWith(
        2,
        'br-1',
        undefined,
        undefined,
        undefined,
        2,
        200,
      );

      expect(caseRepo.save).toHaveBeenCalledTimes(2);
      expect(caseRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          hdPhieuDichVuId: 'case-1',
          soChungTu: 'PDV-001',
        }),
      );

      const lastSaveCall = syncRunRepo.save.mock.calls[1][0];
      expect(lastSaveCall.status).toBe(GwSyncStatus.SUCCESS);
      expect(lastSaveCall.rowCount).toBe(2);
    });

    it('should detect and soft-delete missing cases when full range is provided', async () => {
      clientService.getCases.mockResolvedValueOnce({
        data: [{ HdPhieuDichVuID: 'case-1' }],
        pagination: { totalPages: 1 },
      });
      caseRepo.findOne.mockResolvedValue(null);

      // Mock DB state before detection: DB has case-1 and case-2
      caseRepo.createQueryBuilder = jest.fn().mockReturnValue({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([
          { hdPhieuDichVuId: 'case-1', kgaraDeleteCount: 0 },
          { hdPhieuDichVuId: 'case-2', kgaraDeleteCount: 0 },
        ]),
      });

      // Case-2 has no linked invoices
      linkedInvoiceRepo.count.mockResolvedValue(0);

      const res = await service.syncCasesForBranch(
        'br-1',
        '2026-07-01',
        '2026-07-31',
      );

      expect(res).toEqual({ deletedCount: 1, withLinkedInvoices: [] });

      // Check that case-2 was saved with incremented delete count
      expect(caseRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          hdPhieuDichVuId: 'case-2',
          kgaraDeleteCount: 1,
        }),
      );
    });

    it('should restore previously soft-deleted cases', async () => {
      clientService.getCases.mockResolvedValueOnce({
        data: [{ HdPhieuDichVuID: 'case-3' }],
        pagination: { totalPages: 1 },
      });

      const mockedCase = {
        hdPhieuDichVuId: 'case-3',
        kgaraDeletedAt: new Date(),
        kgaraDeleteCount: 2,
      };
      caseRepo.findOne.mockResolvedValue(mockedCase);

      await service.syncCasesForBranch('br-1');

      expect(caseRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          hdPhieuDichVuId: 'case-3',
          kgaraDeletedAt: null,
          kgaraDeleteCount: 0,
        }),
      );
    });
  });

  describe('syncReceivables', () => {
    it('should sync receivables correctly', async () => {
      clientService.getReceivables.mockResolvedValue({
        data: [
          {
            HdPhieuDichVuID: 'rec-1',
            SoChungTu: 'PT-001',
            KhachHangName: 'Test',
          },
        ],
        pagination: { totalPages: 1 },
      });
      receivableRepo.findOne.mockResolvedValue(null);

      await service.syncReceivables('br-1');

      expect(receivableRepo.save).toHaveBeenCalledTimes(1);
      expect(receivableRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          hdPhieuDichVuId: 'rec-1',
          soChungTu: 'PT-001',
          khachHangName: 'Test',
        }),
      );
    });
  });

  describe('syncPayables', () => {
    it('should sync payables correctly', async () => {
      clientService.getPayables.mockResolvedValue({
        results: {
          data: [{ TaiKhoanID: 'pay-1', DoiTacID: 'dt-1', MaSoTienTe: 'VND' }],
          pagination: { totalPages: 1 },
        },
      });
      payableRepo.findOne.mockResolvedValue(null);

      await service.syncPayables('br-1');

      expect(payableRepo.save).toHaveBeenCalledTimes(1);
      expect(payableRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ taiKhoanId: 'pay-1', doiTacId: 'dt-1' }),
      );
    });
  });

  describe('parseSafeDate', () => {
    it('should correctly parse valid ISO strings and Date objects', () => {
      const now = new Date();
      expect(parseSafeDate(now)).toEqual(now);
      expect(parseSafeDate('2026-08-01T00:00:00Z')?.toISOString()).toEqual(
        '2026-08-01T00:00:00.000Z',
      );
      expect(parseSafeDate('2026-08-05')?.toISOString().split('T')[0]).toEqual(
        '2026-08-05',
      );
    });

    it('should parse DD/MM/YYYY and DD/MM/YYYY HH:mm:ss format', () => {
      const parsed = parseSafeDate('05/08/2026 14:30:00');
      expect(parsed).not.toBeNull();
      expect(parsed?.getFullYear()).toEqual(2026);
      expect(parsed?.getMonth()).toEqual(7); // August (0-indexed)
      expect(parsed?.getDate()).toEqual(5);
    });

    it('should safely return null for invalid or empty dates without returning Invalid Date', () => {
      expect(parseSafeDate(null)).toBeNull();
      expect(parseSafeDate(undefined)).toBeNull();
      expect(parseSafeDate('')).toBeNull();
      expect(parseSafeDate('null')).toBeNull();
      expect(parseSafeDate('undefined')).toBeNull();
      expect(parseSafeDate('0001-01-01T00:00:00')).toBeNull();
      expect(parseSafeDate('1900-01-01T00:00:00')).toBeNull();
      expect(parseSafeDate('0NaN-NaN-NaNTNaN:NaN:NaN.NaN+NaN:NaN')).toBeNull();
      expect(parseSafeDate('invalid-date-string')).toBeNull();
      expect(parseSafeDate(new Date(NaN))).toBeNull();
    });
  });

  describe('syncCasesForBranch with malformed date fields', () => {
    it('should handle malformed date fields from KGara without throwing or storing NaN', async () => {
      clientService.getCases.mockResolvedValueOnce({
        data: [
          {
            HdPhieuDichVuID: 'case-bad-date',
            SoChungTu: 'PDV-001',
            NgayPhatSinhFull: '0001-01-01T00:00:00',
            NgayPhatSinh: 'invalid-date',
            NgayTiepNhan: '0NaN-NaN-NaN',
            NgayHoanThanhCongViec: null,
            NgayGiaoXeFull: undefined,
          },
        ],
        pagination: { totalPages: 1 },
        dataAsOf: 'null',
      });
      caseRepo.findOne.mockResolvedValue(null);

      const res = await service.syncCasesForBranch(
        'br-1',
        '2026-08-01',
        '2026-08-05',
      );

      expect(caseRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          hdPhieuDichVuId: 'case-bad-date',
          ngayPhatSinh: null,
          ngayTiepNhan: null,
          ngayHoanThanhCongViec: null,
          ngayGiaoXeFull: null,
          dataAsOf: null,
        }),
      );
    });
  });

  describe('Preservation of ERP internal fields during sync', () => {
    it('should preserve classification and erpNotes when syncing cases for branch', async () => {
      clientService.getCases.mockResolvedValueOnce({
        data: [
          {
            HdPhieuDichVuID: 'case-preserve-1',
            SoChungTu: 'PDV-202608-001',
            BienSoXe: '30A-12345',
            TenTinhTrangDichVu: 'Đang sửa',
            TinhTrangDichVu: 2,
          },
        ],
        pagination: { totalPages: 1 },
      });

      const existingCase = {
        id: 'uuid-1',
        hdPhieuDichVuId: 'case-preserve-1',
        soChungTu: 'PDV-202608-001',
        classification: 'KY_GUI_NOI_BO',
        erpNotes: 'Ghi chú quan trọng từ ERP',
      };
      caseRepo.findOne.mockResolvedValue(existingCase);

      await service.syncCasesForBranch('br-1');

      expect(caseRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          hdPhieuDichVuId: 'case-preserve-1',
          classification: 'KY_GUI_NOI_BO',
          erpNotes: 'Ghi chú quan trọng từ ERP',
        }),
      );
    });

    it('should preserve classification and erpNotes when syncing case detail', async () => {
      clientService.getCaseDetail.mockResolvedValueOnce({
        data: {
          HdPhieuDichVuID: 'case-preserve-2',
          SoChungTu: 'PDV-202608-002',
          BienSoXe: '30B-99999',
          TenTinhTrangDichVu: 'Hoàn tất',
          TinhTrangDichVu: 3,
        },
      });

      const existingCase = {
        id: 'uuid-2',
        hdPhieuDichVuId: 'case-preserve-2',
        soChungTu: 'PDV-202608-002',
        classification: 'OJ',
        erpNotes: 'Gia công bên ngoài',
      };
      caseRepo.findOne.mockResolvedValue(existingCase);

      await service.syncCaseDetail('br-1', 'case-preserve-2');

      expect(caseRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          hdPhieuDichVuId: 'case-preserve-2',
          classification: 'OJ',
          erpNotes: 'Gia công bên ngoài',
        }),
      );
    });
  });
});
