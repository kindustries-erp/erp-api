import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import {
  GarageCaseForecastService,
  CaseForecastInput,
} from './garage-case-forecast.service';
import { KgaraCashflowVoucher } from '../entities/kgara_cashflow_voucher.entity';

describe('GarageCaseForecastService', () => {
  let service: GarageCaseForecastService;
  let voucherRepo: jest.Mocked<Repository<KgaraCashflowVoucher>>;

  beforeEach(async () => {
    const mockRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn().mockImplementation((dto) => ({ ...dto, id: 'v-1' })),
      save: jest.fn().mockImplementation(async (entity) => ({ ...entity })),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GarageCaseForecastService,
        {
          provide: getRepositoryToken(KgaraCashflowVoucher),
          useValue: mockRepo,
        },
      ],
    }).compile();

    service = module.get<GarageCaseForecastService>(GarageCaseForecastService);
    voucherRepo = module.get(getRepositoryToken(KgaraCashflowVoucher));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Rule 1: New status === 3 (Hoàn tất)', () => {
    it('should create an EXPECTED receipt with transDate = completionDate + 7 days when none exists', async () => {
      voucherRepo.findOne.mockResolvedValue(null);

      const input: CaseForecastInput = {
        caseId: 'case-123',
        previousStatus: 2,
        newStatus: 3,
        ngayHoanThanhCongViec: new Date('2026-10-10T10:00:00Z'),
        tienConPhaiThanhToan: 5000000,
        khachHangName: 'Nguyễn Văn A',
        licensePlate: '51A-99999',
        soChungTu: 'SC-001',
      };

      await service.syncCaseForecast(input);

      expect(voucherRepo.findOne).toHaveBeenCalledWith({
        where: {
          caseId: 'case-123',
          voucherType: 'RECEIPT',
          isAutoExpected: true,
          paymentStatus: In(['EXPECTED', 'CANCELLED']),
        },
        order: { createdAt: 'DESC' },
      });

      expect(voucherRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          voucherType: 'RECEIPT',
          paymentStatus: 'EXPECTED',
          isAutoExpected: true,
          amount: 5000000,
          transDate: '2026-10-17',
          caseId: 'case-123',
          partnerName: 'Nguyễn Văn A',
          licensePlate: '51A-99999',
        }),
      );
      expect(voucherRepo.save).toHaveBeenCalled();
    });

    it('should update existing EXPECTED receipt if already exists (idempotency)', async () => {
      const existingVoucher = {
        id: 'v-1',
        voucherCode: 'DT-GARA-261010-001',
        voucherType: 'RECEIPT',
        paymentStatus: 'EXPECTED',
        isAutoExpected: true,
        amount: 3000000,
        transDate: '2026-10-17',
        caseId: 'case-123',
      } as KgaraCashflowVoucher;

      voucherRepo.findOne.mockResolvedValue(existingVoucher);

      const input: CaseForecastInput = {
        caseId: 'case-123',
        previousStatus: 3,
        newStatus: 3,
        ngayHoanThanhCongViec: new Date('2026-10-10T10:00:00Z'),
        tienConPhaiThanhToan: 4000000,
        khachHangName: 'Nguyễn Văn A Mới',
      };

      await service.syncCaseForecast(input);

      expect(voucherRepo.create).not.toHaveBeenCalled();
      expect(voucherRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'v-1',
          amount: 4000000,
          partnerName: 'Nguyễn Văn A Mới',
          paymentStatus: 'EXPECTED',
        }),
      );
    });

    it('should reopen CANCELLED receipt to EXPECTED when case completes again', async () => {
      const existingVoucher = {
        id: 'v-1',
        voucherCode: 'DT-GARA-261010-001',
        voucherType: 'RECEIPT',
        paymentStatus: 'CANCELLED',
        isAutoExpected: true,
        amount: 3000000,
        transDate: '2026-10-17',
        caseId: 'case-123',
      } as KgaraCashflowVoucher;

      voucherRepo.findOne.mockResolvedValue(existingVoucher);

      const input: CaseForecastInput = {
        caseId: 'case-123',
        previousStatus: 2,
        newStatus: 3,
        ngayHoanThanhCongViec: new Date('2026-10-10T10:00:00Z'),
        tienConPhaiThanhToan: 3500000,
      };

      await service.syncCaseForecast(input);

      expect(voucherRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'v-1',
          paymentStatus: 'EXPECTED',
          amount: 3500000,
        }),
      );
    });

    it('phiếu tự sinh đã Đã thu (8tr) thì phần còn lại (2tr) tạo dự thu mới, không đè phiếu đã thu', async () => {
      // Không còn phiếu EXPECTED/CANCELLED đang mở: truy vấn trả về null
      voucherRepo.findOne.mockResolvedValue(null);

      const input: CaseForecastInput = {
        caseId: 'case-123',
        previousStatus: 2,
        newStatus: 3,
        ngayHoanThanhCongViec: new Date('2026-10-10T10:00:00Z'),
        tienConPhaiThanhToan: 2000000,
      };

      await service.syncCaseForecast(input);

      expect(voucherRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          paymentStatus: 'EXPECTED',
          isAutoExpected: true,
          amount: 2000000,
        }),
      );
      expect(voucherRepo.save).toHaveBeenCalledTimes(1);
    });

    it('dự thu 10tr, khách thu 8tr → còn 2tr thì cập nhật đúng phiếu EXPECTED thành 2tr', async () => {
      const expected = {
        id: 'v-1',
        voucherCode: 'DT-GARA-261018-001',
        voucherType: 'RECEIPT',
        paymentStatus: 'EXPECTED',
        isAutoExpected: true,
        amount: 10000000,
        caseId: 'case-123',
      } as KgaraCashflowVoucher;
      voucherRepo.findOne.mockResolvedValue(expected);

      await service.syncCaseForecast({
        caseId: 'case-123',
        previousStatus: 3,
        newStatus: 3,
        ngayHoanThanhCongViec: new Date('2026-10-10T10:00:00Z'),
        tienConPhaiThanhToan: 2000000,
      });

      expect(voucherRepo.create).not.toHaveBeenCalled();
      expect(voucherRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'v-1',
          amount: 2000000,
          paymentStatus: 'EXPECTED',
        }),
      );
    });

    it('should NOT create an EXPECTED receipt if tienConPhaiThanhToan is 0 or negative', async () => {
      voucherRepo.findOne.mockResolvedValue(null);

      const input: CaseForecastInput = {
        caseId: 'case-paid',
        previousStatus: 2,
        newStatus: 3,
        ngayHoanThanhCongViec: new Date('2026-10-10T10:00:00Z'),
        tienConPhaiThanhToan: 0,
        khachHangName: 'Đã thanh toán đủ',
      };

      await service.syncCaseForecast(input);

      expect(voucherRepo.create).not.toHaveBeenCalled();
      expect(voucherRepo.save).not.toHaveBeenCalled();
    });

    it('should mark existing EXPECTED receipt as CANCELLED if case is fully paid (amount <= 0)', async () => {
      const existingExpected = {
        id: 'v-expected',
        voucherCode: 'DT-GARA-261010-009',
        voucherType: 'RECEIPT',
        paymentStatus: 'EXPECTED',
        isAutoExpected: true,
        amount: 2000000,
        caseId: 'case-now-paid',
      } as KgaraCashflowVoucher;

      voucherRepo.findOne.mockResolvedValue(existingExpected);

      const input: CaseForecastInput = {
        caseId: 'case-now-paid',
        previousStatus: 3,
        newStatus: 3,
        ngayHoanThanhCongViec: new Date('2026-10-10T10:00:00Z'),
        tienConPhaiThanhToan: 0,
      };

      await service.syncCaseForecast(input);

      expect(voucherRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'v-expected',
          paymentStatus: 'CANCELLED',
          amount: 0,
        }),
      );
    });
  });

  describe('Rule 2: Previous status === 3 and newStatus !== 3', () => {
    it('should mark auto-forecast EXPECTED receipts as CANCELLED', async () => {
      const expectedVoucher = {
        id: 'v-1',
        voucherCode: 'DT-GARA-261010-001',
        voucherType: 'RECEIPT',
        paymentStatus: 'EXPECTED',
        isAutoExpected: true,
        caseId: 'case-123',
      } as KgaraCashflowVoucher;

      voucherRepo.find.mockResolvedValue([expectedVoucher]);

      const input: CaseForecastInput = {
        caseId: 'case-123',
        previousStatus: 3,
        newStatus: 2, // Reverted to in-progress
      };

      await service.syncCaseForecast(input);

      expect(voucherRepo.find).toHaveBeenCalledWith({
        where: {
          caseId: 'case-123',
          voucherType: 'RECEIPT',
          isAutoExpected: true,
        },
      });

      expect(voucherRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'v-1',
          paymentStatus: 'CANCELLED',
        }),
      );
    });

    it('should NOT cancel voucher if it is already PAID or APPROVED', async () => {
      const paidVoucher = {
        id: 'v-1',
        voucherCode: 'DT-GARA-261010-001',
        voucherType: 'RECEIPT',
        paymentStatus: 'PAID',
        isAutoExpected: true,
        caseId: 'case-123',
      } as KgaraCashflowVoucher;

      voucherRepo.find.mockResolvedValue([paidVoucher]);

      const input: CaseForecastInput = {
        caseId: 'case-123',
        previousStatus: 3,
        newStatus: 9, // Case cancelled
      };

      await service.syncCaseForecast(input);

      expect(voucherRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('Non-blocking behavior', () => {
    it('should not throw if repository throws an error', async () => {
      voucherRepo.findOne.mockRejectedValue(new Error('DB connection lost'));

      const input: CaseForecastInput = {
        caseId: 'case-123',
        previousStatus: 2,
        newStatus: 3,
      };

      await expect(service.syncCaseForecast(input)).resolves.not.toThrow();
    });
  });
});
