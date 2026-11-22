import { Test } from '@nestjs/testing';
import { NotificationInboxCommandService } from './services/notification-inbox-command.service';
import { NotificationInboxQueryService } from './services/notification-inbox-query.service';
import { NotificationsInboxService } from './notifications-inbox.service';

describe('NotificationsInboxService DI', () => {
  it('được tạo với đúng hai dependency của module (constructor DI sạch)', async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        NotificationsInboxService,
        { provide: NotificationInboxQueryService, useValue: {} },
        { provide: NotificationInboxCommandService, useValue: {} },
      ],
    }).compile();

    expect(moduleRef.get(NotificationsInboxService)).toBeInstanceOf(
      NotificationsInboxService,
    );
  });
});
