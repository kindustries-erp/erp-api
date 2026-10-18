import { Test, TestingModule } from '@nestjs/testing';
import { GarageCaseLifecycleHandler } from './garage-case-lifecycle.handler';
import { GarageCaseForecastService } from '../../services/garage-case-forecast.service';
import { CaseTransitionEvent } from '../garage-hub.types';

describe('GarageCaseLifecycleHandler', () => {
  let handler: GarageCaseLifecycleHandler;
  let forecastService: jest.Mocked<GarageCaseForecastService>;

  beforeEach(async () => {
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
});
