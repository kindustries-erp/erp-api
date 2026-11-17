import 'reflect-metadata';
import { AppModule } from '@/app.module';
import { GARAGE_LEDGER_PROJECTOR } from '@/kgara-api-core/hub/ledger-projector.port';
import { CashflowVouchersGarageModule } from '../cashflow-vouchers-garage/cashflow-vouchers-garage.module';
import { DebtsGarageModule } from '../debts-garage/debts-garage.module';
import { DebtsFlowGarageModule } from './debts-flow-garage.module';
import { LegacyKgaraMirrorService } from './legacy/legacy-kgara-mirror.service';
import { LegacyProjectorService } from './legacy/legacy-projector.service';

/** Kiểm tra khai báo module (không dựng DB): đăng ký ở app.module, import đủ, cổng projector cho V1. */
describe('DebtsFlowGarageModule wiring', () => {
  const meta = (key: string, target: object): unknown[] =>
    Reflect.getMetadata(key, target) ?? [];

  it('app.module đăng ký thu chi garage và orchestrator', () => {
    const imports = meta('imports', AppModule);
    expect(imports).toContain(CashflowVouchersGarageModule);
    expect(imports).toContain(DebtsFlowGarageModule);
  });

  it('orchestrator import sổ nợ, thu chi và có mirror + projector', () => {
    const imports = meta('imports', DebtsFlowGarageModule);
    expect(imports).toContain(DebtsGarageModule);
    expect(imports).toContain(CashflowVouchersGarageModule);
    const providers = meta('providers', DebtsFlowGarageModule);
    expect(providers).toContain(LegacyKgaraMirrorService);
    expect(providers).toContain(LegacyProjectorService);
  });

  it('cổng GARAGE_LEDGER_PROJECTOR trỏ tới LegacyProjectorService để V1 tìm lười', () => {
    const providers = meta('providers', DebtsFlowGarageModule) as Array<{
      provide?: unknown;
      useExisting?: unknown;
    }>;
    expect(
      providers.find((p) => p?.provide === GARAGE_LEDGER_PROJECTOR),
    ).toMatchObject({ useExisting: LegacyProjectorService });
  });
});
