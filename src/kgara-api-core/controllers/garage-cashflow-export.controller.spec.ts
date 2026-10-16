import { Test, TestingModule } from '@nestjs/testing';
import { GarageCashflowExportController } from './garage-cashflow-export.controller';
import { GarageExportJobsService } from '../services/garage-export-jobs.service';
import { RBAC_PERMISSIONS_KEY } from '../../auth/decorators/require-permissions.decorator';
import { CoreRbacGuard } from '../../auth/guards/core-rbac.guard';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { ErpAction, ErpResource } from '@/rbac-core/enums';

describe('GarageCashflowExportController', () => {
  let controller: GarageCashflowExportController;
  const mockExportJobs = {
    cashflowRunner: {
      listHistoryForUser: jest.fn().mockReturnValue({ items: [], total: 0 }),
    },
    startCashflowExport: jest.fn().mockReturnValue({
      jobId: 'job-123',
      message: 'Đã bắt đầu',
      reused: false,
    }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [GarageCashflowExportController],
      providers: [
        { provide: GarageExportJobsService, useValue: mockExportJobs },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(CoreRbacGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(GarageCashflowExportController);
  });

  it('all routes require GARAGE_CASHFLOW:READ permission', () => {
    const proto = GarageCashflowExportController.prototype;
    const methods = ['start', 'history', 'download', 'progressStream'] as const;

    for (const name of methods) {
      const perms = Reflect.getMetadata(RBAC_PERMISSIONS_KEY, proto[name]);
      expect(perms).toEqual([
        { resource: ErpResource.GARAGE_CASHFLOW, action: ErpAction.READ },
      ]);
    }
  });

  it('start calls exportJobs.startCashflowExport with dto and userId', () => {
    const dto = { periodType: 'month' as const, period: '2026-10' };
    const res = controller.start(dto, { user: { sub: 'user-1' } });

    expect(mockExportJobs.startCashflowExport).toHaveBeenCalledWith(
      dto,
      'user-1',
    );
    expect(res).toEqual({
      jobId: 'job-123',
      message: 'Đã bắt đầu',
      reused: false,
    });
  });

  it('history queries cashflowRunner history for user', () => {
    controller.history({ user: { sub: 'user-1' } }, '1', '10');
    expect(
      mockExportJobs.cashflowRunner.listHistoryForUser,
    ).toHaveBeenCalledWith('user-1', 1, 10);
  });
});
