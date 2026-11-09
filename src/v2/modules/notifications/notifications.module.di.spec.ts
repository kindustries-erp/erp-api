import { Test } from '@nestjs/testing';
import {
  NotificationCommandService,
  NotificationQueryService,
} from '@/v2/core/notifications-core';
import { NotificationsV2Service } from './notifications.service';

describe('NotificationsV2Service DI', () => {
  it('được tạo với đúng hai dependency của lõi (constructor DI sạch)', async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        NotificationsV2Service,
        { provide: NotificationQueryService, useValue: {} },
        { provide: NotificationCommandService, useValue: {} },
      ],
    }).compile();

    expect(moduleRef.get(NotificationsV2Service)).toBeInstanceOf(
      NotificationsV2Service,
    );
  });
});
