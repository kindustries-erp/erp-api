import { Reflector } from '@nestjs/core';
import { GarageCashflowController } from './garage-cashflow.controller';
import {
  RBAC_PERMISSIONS_KEY,
  RBAC_ANY_PERMISSIONS_KEY,
} from '../../auth/decorators/require-permissions.decorator';
import { ErpResource, ErpAction } from '@/rbac-core/enums';

describe('GarageCashflowController RBAC Permissions', () => {
  const reflector = new Reflector();

  it('listVouchers requires GARAGE_CASHFLOW:READ', () => {
    const handler = GarageCashflowController.prototype.listVouchers;
    const perms = reflector.get(RBAC_PERMISSIONS_KEY, handler);

    expect(perms).toBeDefined();
    expect(perms).toEqual([
      { resource: ErpResource.GARAGE_CASHFLOW, action: ErpAction.READ },
    ]);
  });

  it('getDashboard requires GARAGE_CASHFLOW:READ', () => {
    const handler = GarageCashflowController.prototype.getDashboard;
    const perms = reflector.get(RBAC_PERMISSIONS_KEY, handler);

    expect(perms).toBeDefined();
    expect(perms).toEqual([
      { resource: ErpResource.GARAGE_CASHFLOW, action: ErpAction.READ },
    ]);
  });

  it('getColumnOptions requires GARAGE_CASHFLOW:READ', () => {
    const handler = GarageCashflowController.prototype.getColumnOptions;
    const perms = reflector.get(RBAC_PERMISSIONS_KEY, handler);

    expect(perms).toBeDefined();
    expect(perms).toEqual([
      { resource: ErpResource.GARAGE_CASHFLOW, action: ErpAction.READ },
    ]);
  });

  it('checkDuplicates requires GARAGE_CASHFLOW:CREATE or UPDATE', () => {
    const handler = GarageCashflowController.prototype.checkDuplicates;
    const perms = reflector.get(RBAC_ANY_PERMISSIONS_KEY, handler);

    expect(perms).toEqual([
      { resource: ErpResource.GARAGE_CASHFLOW, action: ErpAction.CREATE },
      { resource: ErpResource.GARAGE_CASHFLOW, action: ErpAction.UPDATE },
    ]);
  });

  it('createVoucher requires GARAGE_CASHFLOW:CREATE', () => {
    const handler = GarageCashflowController.prototype.createVoucher;
    const perms = reflector.get(RBAC_PERMISSIONS_KEY, handler);

    expect(perms).toBeDefined();
    expect(perms).toEqual([
      { resource: ErpResource.GARAGE_CASHFLOW, action: ErpAction.CREATE },
    ]);
  });

  it('updateVoucher requires GARAGE_CASHFLOW:UPDATE', () => {
    const handler = GarageCashflowController.prototype.updateVoucher;
    const perms = reflector.get(RBAC_PERMISSIONS_KEY, handler);

    expect(perms).toBeDefined();
    expect(perms).toEqual([
      { resource: ErpResource.GARAGE_CASHFLOW, action: ErpAction.UPDATE },
    ]);
  });

  it('deleteVoucher requires GARAGE_CASHFLOW:DELETE', () => {
    const handler = GarageCashflowController.prototype.deleteVoucher;
    const perms = reflector.get(RBAC_PERMISSIONS_KEY, handler);

    expect(perms).toBeDefined();
    expect(perms).toEqual([
      { resource: ErpResource.GARAGE_CASHFLOW, action: ErpAction.DELETE },
    ]);
  });

  it('getDashboard calls cashflowService.getDashboardStats with query', async () => {
    const mockService = {
      getDashboardStats: jest.fn().mockResolvedValue({ kpi: {} }),
    };
    const controller = new GarageCashflowController(mockService as any);
    const query = { dateFrom: '2026-10-01', dateTo: '2026-10-15' };

    const result = await controller.getDashboard(query);

    expect(mockService.getDashboardStats).toHaveBeenCalledWith(query);
    expect(result).toEqual({ kpi: {} });
  });
});
