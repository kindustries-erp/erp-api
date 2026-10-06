import { Reflector } from '@nestjs/core';
import { DashboardCoreController } from './dashboard-core.controller';
import { ErpResource, ErpAction } from '@/rbac-core/enums';
import { RBAC_PERMISSIONS_KEY } from '../auth/decorators/require-permissions.decorator';

describe('DashboardCoreController', () => {
  const service = {
    getOverview: jest.fn(),
    getCashflowForecast: jest.fn(),
    getBudgetSuggestions: jest.fn(),
  } as any;

  let controller: DashboardCoreController;
  const reflector = new Reflector();

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new DashboardCoreController(service);
  });

  describe('RBAC Metadata Verification', () => {
    it('requires DASHBOARD:READ permission on getOverview', () => {
      const perms = reflector.get(RBAC_PERMISSIONS_KEY, controller.getOverview);
      expect(perms).toEqual([
        { resource: ErpResource.DASHBOARD, action: ErpAction.READ },
      ]);
    });

    it('requires DASHBOARD:READ permission on getCashflowForecast', () => {
      const perms = reflector.get(
        RBAC_PERMISSIONS_KEY,
        controller.getCashflowForecast,
      );
      expect(perms).toEqual([
        { resource: ErpResource.DASHBOARD, action: ErpAction.READ },
      ]);
    });

    it('requires DASHBOARD:READ permission on getBudgetSuggestions', () => {
      const perms = reflector.get(
        RBAC_PERMISSIONS_KEY,
        controller.getBudgetSuggestions,
      );
      expect(perms).toEqual([
        { resource: ErpResource.DASHBOARD, action: ErpAction.READ },
      ]);
    });
  });

  describe('Service Delegation', () => {
    it('delegates getOverview to service with query', async () => {
      const query = { startDate: '2026-01-01', endDate: '2026-01-31' };
      service.getOverview.mockResolvedValue({ summary: 'ok' });

      const result = await controller.getOverview(query);
      expect(result).toEqual({ summary: 'ok' });
      expect(service.getOverview).toHaveBeenCalledWith(query);
    });

    it('delegates getCashflowForecast to service', async () => {
      const query = { months: '6' };
      service.getCashflowForecast.mockResolvedValue({ forecast: [] });

      const result = await controller.getCashflowForecast(query);
      expect(result).toEqual({ forecast: [] });
      expect(service.getCashflowForecast).toHaveBeenCalledWith(query);
    });

    it('delegates getBudgetSuggestions to service', async () => {
      const query = { branchId: 'branch-1' };
      service.getBudgetSuggestions.mockResolvedValue({ suggestions: [] });

      const result = await controller.getBudgetSuggestions(query);
      expect(result).toEqual({ suggestions: [] });
      expect(service.getBudgetSuggestions).toHaveBeenCalledWith(query);
    });
  });
});
