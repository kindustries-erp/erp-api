import 'reflect-metadata';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ApprovalActorService } from '@/v2/core/approval-core/approval-actor.service';
import { CoreUser } from '@/users/entities/core-user.entity';
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

describe('Đăng ký ApprovalActorService trong module procurement', () => {
  it.each(MODULES)(
    '%s: có CoreUser repository trực tiếp trong forFeature (nơi ApprovalActorService inject)',
    (_name, mod) => {
      const providers = (Reflect.getMetadata('providers', mod) ??
        []) as unknown[];
      expect(providers).toContain(ApprovalActorService);
      expect(ownRepositoryTokens(mod).has(getRepositoryToken(CoreUser))).toBe(
        true,
      );
    },
  );
});
