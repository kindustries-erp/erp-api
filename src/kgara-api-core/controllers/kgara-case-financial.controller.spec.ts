import { Reflector } from '@nestjs/core';
import { KgaraCaseFinancialController } from './kgara-case-financial.controller';
import { RBAC_ANY_PERMISSIONS_KEY } from '../../auth/decorators/require-permissions.decorator';
import { ErpResource, ErpAction } from '@/rbac-core/enums';

describe('KgaraCaseFinancialController RBAC Permissions', () => {
  const reflector = new Reflector();

  it('addLinkedInvoice allows both GARAGE:UPDATE and INVOICES:UPDATE via RequireAnyPermissions', () => {
    const handler = KgaraCaseFinancialController.prototype.addLinkedInvoice;
    const perms = reflector.get(RBAC_ANY_PERMISSIONS_KEY, handler);

    expect(perms).toBeDefined();
    expect(perms).toEqual(
      expect.arrayContaining([
        { resource: ErpResource.GARAGE, action: ErpAction.UPDATE },
        { resource: ErpResource.INVOICES, action: ErpAction.UPDATE },
      ]),
    );
  });

  it('addCaseSettlement allows GARAGE, INVOICES, BANK_STATEMENTS, and CASH_STATEMENTS via RequireAnyPermissions', () => {
    const handler = KgaraCaseFinancialController.prototype.addCaseSettlement;
    const perms = reflector.get(RBAC_ANY_PERMISSIONS_KEY, handler);

    expect(perms).toBeDefined();
    expect(perms).toEqual(
      expect.arrayContaining([
        { resource: ErpResource.GARAGE, action: ErpAction.UPDATE },
        { resource: ErpResource.INVOICES, action: ErpAction.UPDATE },
        { resource: ErpResource.BANK_STATEMENTS, action: ErpAction.UPDATE },
        { resource: ErpResource.CASH_STATEMENTS, action: ErpAction.UPDATE },
      ]),
    );
  });

  it('removeCaseSettlement allows GARAGE, INVOICES, BANK_STATEMENTS via RequireAnyPermissions', () => {
    const handler = KgaraCaseFinancialController.prototype.removeCaseSettlement;
    const perms = reflector.get(RBAC_ANY_PERMISSIONS_KEY, handler);

    expect(perms).toBeDefined();
    expect(perms).toEqual(
      expect.arrayContaining([
        { resource: ErpResource.GARAGE, action: ErpAction.DELETE },
        { resource: ErpResource.INVOICES, action: ErpAction.UPDATE },
        { resource: ErpResource.BANK_STATEMENTS, action: ErpAction.UPDATE },
      ]),
    );
  });

  it('updateCaseSettlement allows GARAGE, INVOICES, BANK_STATEMENTS via RequireAnyPermissions', () => {
    const handler = KgaraCaseFinancialController.prototype.updateCaseSettlement;
    const perms = reflector.get(RBAC_ANY_PERMISSIONS_KEY, handler);

    expect(perms).toBeDefined();
    expect(perms).toEqual(
      expect.arrayContaining([
        { resource: ErpResource.GARAGE, action: ErpAction.UPDATE },
        { resource: ErpResource.INVOICES, action: ErpAction.UPDATE },
        { resource: ErpResource.BANK_STATEMENTS, action: ErpAction.UPDATE },
      ]),
    );
  });
});
