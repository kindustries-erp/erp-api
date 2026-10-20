import { Test, TestingModule } from '@nestjs/testing';
import { GarageOpexExportController } from './garage-opex-export.controller';
import { GarageExportJobsService } from '../services/garage-export-jobs.service';
import { RBAC_PERMISSIONS_KEY } from '../../auth/decorators/require-permissions.decorator';
import { CoreRbacGuard } from '../../auth/guards/core-rbac.guard';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { ErpAction, ErpResource } from '@/rbac-core/enums';

describe('GarageOpexExportController', () => {
  let controller: GarageOpexExportController;
  const mockExportJobs = {
    opexRunner: {
      listHistoryForUser: jest.fn().mockReturnValue({ items: [], total: 0 }),
    },
    startOpexExport: jest.fn().mockReturnValue({
      jobId: 'job-opex-1',
      message: 'Đã bắt đầu',
      reused: false,
    }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [GarageOpexExportController],
      providers: [
        { provide: GarageExportJobsService, useValue: mockExportJobs },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(CoreRbacGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(GarageOpexExportController);
  });

  it('all routes require GARAGE:READ permission', () => {
    const proto = GarageOpexExportController.prototype;
    const methods = ['start', 'history', 'download', 'progressStream'] as const;

    for (const name of methods) {
      const perms = Reflect.getMetadata(RBAC_PERMISSIONS_KEY, proto[name]);
      expect(perms).toEqual([
        { resource: ErpResource.GARAGE, action: ErpAction.READ },
      ]);
    }
  });

  it('start calls exportJobs.startOpexExport with dto and userId', () => {
    const dto = { mode: 'by-period' as const, year: 2026, month: 10 };
    const res = controller.start(dto, { user: { sub: 'user-1' } });

    expect(mockExportJobs.startOpexExport).toHaveBeenCalledWith(dto, 'user-1');
    expect(res).toEqual({
      jobId: 'job-opex-1',
      message: 'Đã bắt đầu',
      reused: false,
    });
  });

  it('history queries opexRunner history for user', () => {
    controller.history({ user: { sub: 'user-1' } }, '1', '10');
    expect(mockExportJobs.opexRunner.listHistoryForUser).toHaveBeenCalledWith(
      'user-1',
      1,
      10,
    );
  });
});
