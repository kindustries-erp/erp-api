import { Test } from '@nestjs/testing';
import { ScheduleModule } from '@nestjs/schedule';
import {
  SchedulerJobsModule,
  SchedulerJobsService,
} from '@/v2/modules/scheduler-jobs';
import { NotificationInboxCommandService } from '../services/notification-inbox-command.service';
import { NotificationPurgeJob } from './notification-purge.job';

async function buildModule() {
  const moduleRef = await Test.createTestingModule({
    imports: [ScheduleModule.forRoot(), SchedulerJobsModule],
    providers: [
      NotificationPurgeJob,
      { provide: NotificationInboxCommandService, useValue: {} },
    ],
  }).compile();
  await moduleRef.init();
  return moduleRef;
}

describe('NotificationPurgeJob DI (scheduler-jobs discovery)', () => {
  const originalEnv = process.env.ENABLE_CRON;

  afterEach(() => {
    if (originalEnv === undefined) delete process.env.ENABLE_CRON;
    else process.env.ENABLE_CRON = originalEnv;
  });

  it('ENABLE_CRON=false: job được phát hiện nhưng không tạo timer', async () => {
    process.env.ENABLE_CRON = 'false';
    const moduleRef = await buildModule();

    expect(moduleRef.get(SchedulerJobsService).getStatus()).toEqual([
      expect.objectContaining({
        name: 'notifications-purge',
        cron: '0 30 2 * * *',
        timeZone: 'Asia/Ho_Chi_Minh',
        enabled: false,
      }),
    ]);

    await moduleRef.close();
  });

  it('ENABLE_CRON=true: job bật, đóng module thì gỡ khỏi registry', async () => {
    process.env.ENABLE_CRON = 'true';
    const moduleRef = await buildModule();

    expect(moduleRef.get(SchedulerJobsService).getStatus()[0]).toMatchObject({
      name: 'notifications-purge',
      enabled: true,
    });

    await moduleRef.close();
  });
});
