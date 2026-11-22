import 'reflect-metadata';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ApprovalActorService } from '@/v2/modules/approval-management/services/approval-actor.service';
import { ApprovalManagementModule } from '@/v2/modules/approval-management/approval-management.module';
import { UsersManagement } from '@/v2/modules/users-management/entities/users-management.entity';
import { GarageProcurementRequestsModule } from './procurement-requests-garage/procurement-requests-garage.module';
import { GarageProcurementOrdersModule } from './procurement-orders-garage/procurement-orders-garage.module';
import { ErpProcurementRequestsModule } from './procurement-requests-erp/procurement-requests-erp.module';
import { ErpProcurementOrdersModule } from './procurement-orders-erp/procurement-orders-erp.module';

type ModuleRef = { provide?: unknown; module?: unknown; providers?: unknown[] };

/** Token của mọi repository do TypeOrmModule.forFeature đăng ký trực tiếp trong module. */
function ownRepositoryTokens(mod: object): Set<unknown> {
  const tokens = new Set<unknown>();
  const imports = (Reflect.getMetadata('imports', mod) ?? []) as ModuleRef[];
  for (const imp of imports) {
    for (const provider of imp.providers ?? []) {
      const p = provider as { provide?: unknown };
      if (p && p.provide !== undefined) tokens.add(p.provide);
    }
  }
  return tokens;
}

const MODULES: Array<[string, object]> = [
  ['procurement-requests-garage', GarageProcurementRequestsModule],
  ['procurement-orders-garage', GarageProcurementOrdersModule],
  ['procurement-requests-erp', ErpProcurementRequestsModule],
  ['procurement-orders-erp', ErpProcurementOrdersModule],
];

describe('Đăng ký ApprovalActorService qua ApprovalManagementModule', () => {
  it('ApprovalManagementModule cung cấp ApprovalActorService và có UsersManagement repository trực tiếp (nơi service inject)', () => {
    const providers = (Reflect.getMetadata(
      'providers',
      ApprovalManagementModule,
    ) ?? []) as unknown[];
    const exported = (Reflect.getMetadata(
      'exports',
      ApprovalManagementModule,
    ) ?? []) as unknown[];
    expect(providers).toContain(ApprovalActorService);
    expect(exported).toContain(ApprovalActorService);
    expect(
      ownRepositoryTokens(ApprovalManagementModule).has(
        getRepositoryToken(UsersManagement),
      ),
    ).toBe(true);
  });

  it.each(MODULES)(
    '%s: import ApprovalManagementModule và không tự đăng ký lại ApprovalActorService',
    (_name, mod) => {
      const imports = (Reflect.getMetadata('imports', mod) ?? []) as unknown[];
      const providers = (Reflect.getMetadata('providers', mod) ??
        []) as unknown[];
      expect(imports).toContain(ApprovalManagementModule);
      expect(providers).not.toContain(ApprovalActorService);
    },
  );
});
