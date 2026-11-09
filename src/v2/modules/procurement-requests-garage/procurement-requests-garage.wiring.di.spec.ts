import 'reflect-metadata';
import { NotificationsInboxModule } from '@/v2/modules/notifications-inbox/notifications-inbox.module';
import { GarageProcurementRequestsModule } from './procurement-requests-garage.module';
import { ProcurementRequestNotifierService } from './services/procurement-request-notifier.service';
import { GarageProcurementRequestsService } from './procurement-requests-garage.service';

/** Kiểm tra khai báo module (không dựng DB): có import thông báo và có notifier làm provider. */
describe('GarageProcurementRequestsModule wiring (thông báo)', () => {
  const imports: unknown[] =
    Reflect.getMetadata('imports', GarageProcurementRequestsModule) ?? [];
  const providers: unknown[] =
    Reflect.getMetadata('providers', GarageProcurementRequestsModule) ?? [];

  it('import NotificationsInboxModule để dùng publisher', () => {
    expect(imports).toContain(NotificationsInboxModule);
  });

  it('đăng ký notifier và facade', () => {
    expect(providers).toContain(ProcurementRequestNotifierService);
    expect(providers).toContain(GarageProcurementRequestsService);
  });
});
