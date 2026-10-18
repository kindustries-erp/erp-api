import { Test, TestingModule } from '@nestjs/testing';
import { GarageCaseLifecycleHandler } from './garage-case-lifecycle.handler';
import { GarageCaseForecastService } from '../../services/garage-case-forecast.service';
import { CaseTransitionEvent } from '../garage-hub.types';
import { getRepositoryToken } from '@nestjs/typeorm';
import { KgaraCase } from '../../entities/kgara_case.entity';

describe('GarageCaseLifecycleHandler', () => {
  let handler: GarageCaseLifecycleHandler;
  let forecastService: jest.Mocked<GarageCaseForecastService>;
  let caseRepo: { findOne: jest.Mock };

  beforeEach(async () => {
    caseRepo = { findOne: jest.fn() };
    const mockForecastService = {
      syncCaseForecast: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GarageCaseLifecycleHandler,
        {
          provide: GarageCaseForecastService,
          useValue: mockForecastService,
        },
        { provide: getRepositoryToken(KgaraCase), useValue: caseRepo },
      ],
    }).compile();

    handler = module.get<GarageCaseLifecycleHandler>(
      GarageCaseLifecycleHandler,
    );
    forecastService = module.get(GarageCaseForecastService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should handle completion (status 3) and call forecastService', async () => {
    const event: CaseTransitionEvent = {
      caseId: 'case-1',
      previousStatus: 2,
      newStatus: 3,
      ngayHoanThanhCongViec: '2026-10-18',
      tienConPhaiThanhToan: 3000000,
    };

    const result = await handler.handleCaseTransition(event);

    expect(forecastService.syncCaseForecast).toHaveBeenCalledWith(event);
    expect(result).toEqual({
      caseId: 'case-1',
      handled: true,
      actionTaken: 'CREATED_EXPECTED',
    });
  });

  it('should handle revert from completion (3 -> 2) and call forecastService', async () => {
    const event: CaseTransitionEvent = {
      caseId: 'case-1',
      previousStatus: 3,
      newStatus: 2,
    };

    const result = await handler.handleCaseTransition(event);

    expect(forecastService.syncCaseForecast).toHaveBeenCalledWith(event);
    expect(result).toEqual({
      caseId: 'case-1',
      handled: true,
      actionTaken: 'CANCELLED_EXPECTED',
    });
  });

  it('should return NO_OP when status transition does not involve status 3', async () => {
    const event: CaseTransitionEvent = {
      caseId: 'case-1',
      previousStatus: 1,
      newStatus: 2,
    };

    const result = await handler.handleCaseTransition(event);

    expect(forecastService.syncCaseForecast).not.toHaveBeenCalled();
    expect(result).toEqual({
      caseId: 'case-1',
      handled: false,
      actionTaken: 'NO_OP',
    });
  });

  describe('handleReceiptChanged', () => {
    it('case đang Hoàn tất: đồng bộ dự thu theo còn phải thu hiện tại', async () => {
      caseRepo.findOne.mockResolvedValue({
        id: 'case-1',
        tinhTrangDichVu: 3,
        ngayHoanThanhCongViec: new Date('2026-10-10T10:00:00Z'),
        tienConPhaiThanhToan: 2000000,
        tienCoThue: 10000000,
        khachHangName: 'A',
        bienSoXe: '51A-1',
        soChungTu: 'SC-1',
      });

      const result = await handler.handleReceiptChanged('case-1');

      expect(result).toEqual({
        caseId: 'case-1',
        handled: true,
        actionTaken: 'UPDATED_EXPECTED',
      });
      expect(forecastService.syncCaseForecast).toHaveBeenCalledWith(
        expect.objectContaining({
          caseId: 'case-1',
          previousStatus: 3,
          newStatus: 3,
          tienConPhaiThanhToan: 2000000,
        }),
      );
    });

    it('case không còn Hoàn tất: không đụng dự thu', async () => {
      caseRepo.findOne.mockResolvedValue({ id: 'case-1', tinhTrangDichVu: 2 });

      const result = await handler.handleReceiptChanged('case-1');

      expect(result.actionTaken).toBe('NO_OP');
      expect(forecastService.syncCaseForecast).not.toHaveBeenCalled();
    });
  });
});
