import { Test } from '@nestjs/testing';
import { ScheduleModule } from '@nestjs/schedule';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  SchedulerJobsModule,
  SchedulerJobsService,
} from '@/v2/modules/scheduler-jobs';
import { NotificationInbox } from './entities/notification-inbox.entity';
import { NotificationsInboxModule } from './notifications-inbox.module';
import { NotificationsPublisherService } from './services/notifications-publisher.service';
import { NotificationPurgeJob } from './jobs/notification-purge.job';

describe('NotificationsInboxModule wiring (DI thật, repo giả)', () => {
  const originalEnv = process.env.ENABLE_CRON;

  afterEach(() => {
    if (originalEnv === undefined) delete process.env.ENABLE_CRON;
    else process.env.ENABLE_CRON = originalEnv;
  });

  it('export publisher cho producer và đăng ký job purge qua scheduler-jobs', async () => {
    process.env.ENABLE_CRON = 'false';
    const moduleRef = await Test.createTestingModule({
      imports: [
        ScheduleModule.forRoot(),
        SchedulerJobsModule,
        NotificationsInboxModule,
      ],
    })
      .overrideProvider(getRepositoryToken(NotificationInbox))
      .useValue({})
      .compile();
    await moduleRef.init();

    expect(moduleRef.get(NotificationsPublisherService)).toBeInstanceOf(
      NotificationsPublisherService,
    );
    expect(moduleRef.get(NotificationPurgeJob)).toBeInstanceOf(
      NotificationPurgeJob,
    );
    expect(
      moduleRef
        .get(SchedulerJobsService)
        .getStatus()
        .map((s) => s.name),
    ).toContain('notifications-purge');

    await moduleRef.close();
  });
});
