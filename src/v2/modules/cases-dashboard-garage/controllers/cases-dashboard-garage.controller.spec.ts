import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { RBAC_PERMISSIONS_KEY } from '@/auth/decorators/require-permissions.decorator';
import { ErpAction, ErpResource } from '@/v2/core/rbac-core';
import { CasesDashboardGarageController } from './cases-dashboard-garage.controller';

describe('CasesDashboardGarageController (v2 dashboard garage)', () => {
  let controller: CasesDashboardGarageController;
  let facade: {
    getOverview: jest.Mock;
    listVehicles: jest.Mock;
  };

  beforeEach(() => {
    facade = {
      getOverview: jest
        .fn()
        .mockResolvedValue({ period: { kpi: true }, funnel: { funnel: true } }),
      listVehicles: jest.fn().mockResolvedValue({ items: [] }),
    };
    controller = new CasesDashboardGarageController(facade as any);
  });

  it('chỉ có đúng hai route: GET / và GET /overview (không còn period-kpis, funnel, cases, vehicles)', () => {
    const proto = CasesDashboardGarageController.prototype;
    const routes = Object.getOwnPropertyNames(proto)
      .filter((name) => name !== 'constructor')
      .map((name) => ({
        name,
        path: Reflect.getMetadata(PATH_METADATA, proto[name as 'list']),
        method: Reflect.getMetadata(METHOD_METADATA, proto[name as 'list']),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    expect(routes).toEqual([
      { name: 'list', path: '/', method: 0 },
      { name: 'overview', path: 'overview', method: 0 },
    ]);
  });

  it('mọi route yêu cầu quyền GARAGE READ', () => {
    for (const method of ['overview', 'list'] as const) {
      const perms = Reflect.getMetadata(
        RBAC_PERMISSIONS_KEY,
        controller[method],
      );
      expect(perms).toEqual([
        { resource: ErpResource.GARAGE, action: ErpAction.READ },
      ]);
    }
  });

  it('overview chuyển date, date_from, date_to xuống facade', async () => {
    await expect(
      controller.overview({
        date: '2026-11-18',
        date_from: '2026-11-01',
        date_to: '2026-11-05',
      }),
    ).resolves.toEqual({ period: { kpi: true }, funnel: { funnel: true } });

    expect(facade.getOverview).toHaveBeenCalledWith(
      '2026-11-18',
      '2026-11-01',
      '2026-11-05',
    );
  });

  it('overview không tham số vẫn gọi facade (mặc định do facade quyết định)', async () => {
    await controller.overview({});

    expect(facade.getOverview).toHaveBeenCalledWith(
      undefined,
      undefined,
      undefined,
    );
  });

  it('list map tham số HTTP sang input của facade', async () => {
    await controller.list({
      date_from: '2026-11-01',
      date_to: '2026-11-30',
      stage: 'quotation',
      page: 2,
      pageSize: 10,
    });

    expect(facade.listVehicles).toHaveBeenCalledWith({
      dateFrom: '2026-11-01',
      dateTo: '2026-11-30',
      stage: 'quotation',
      classification: undefined,
      page: 2,
      pageSize: 10,
    });
  });
});
