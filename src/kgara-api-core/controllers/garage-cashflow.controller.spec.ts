import { Reflector } from '@nestjs/core';
import { GarageCashflowController } from './garage-cashflow.controller';
import { RBAC_PERMISSIONS_KEY } from '../../auth/decorators/require-permissions.decorator';
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
});
