import { RBAC_PERMISSIONS_KEY } from '@/auth/decorators/require-permissions.decorator';
import { ErpAction, ErpResource } from '@/v2/core/rbac-core';
import { CasesDashboardGarageController } from './cases-dashboard-garage.controller';

describe('CasesDashboardGarageController (v2 dashboard garage)', () => {
  let controller: CasesDashboardGarageController;
  let facade: {
    getPeriodKpis: jest.Mock;
    getFunnel: jest.Mock;
    listCases: jest.Mock;
  };

  beforeEach(() => {
    facade = {
      getPeriodKpis: jest.fn().mockResolvedValue({ kpi: true }),
      getFunnel: jest.fn().mockResolvedValue({ funnel: true }),
      listCases: jest.fn().mockResolvedValue({ items: [] }),
    };
    controller = new CasesDashboardGarageController(facade as any);
  });

  it('mọi route yêu cầu quyền GARAGE READ', () => {
    for (const method of ['periodKpis', 'funnel', 'cases'] as const) {
      const perms = Reflect.getMetadata(
        RBAC_PERMISSIONS_KEY,
        controller[method],
      );
      expect(perms).toEqual([
        { resource: ErpResource.GARAGE, action: ErpAction.READ },
      ]);
    }
  });

  it('period-kpis chuyển tham số date xuống facade', async () => {
    await expect(
      controller.periodKpis({ date: '2026-11-18' }),
    ).resolves.toEqual({
      kpi: true,
    });
    expect(facade.getPeriodKpis).toHaveBeenCalledWith('2026-11-18');
  });

  it('funnel chuyển date_from/date_to xuống facade', async () => {
    await controller.funnel({ date_from: '2026-11-01', date_to: '2026-11-05' });
    expect(facade.getFunnel).toHaveBeenCalledWith('2026-11-01', '2026-11-05');
  });

  it('cases map tham số HTTP sang input của facade', async () => {
    await controller.cases({
      date_from: '2026-11-01',
      date_to: '2026-11-30',
      stage: 'completed',
      classification: 'OJ_NGOAI',
      page: 2,
      pageSize: 50,
    });
    expect(facade.listCases).toHaveBeenCalledWith({
      dateFrom: '2026-11-01',
      dateTo: '2026-11-30',
      stage: 'completed',
      classification: 'OJ_NGOAI',
      page: 2,
      pageSize: 50,
    });
  });
});
