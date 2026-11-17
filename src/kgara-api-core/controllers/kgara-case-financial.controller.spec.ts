import { Reflector } from '@nestjs/core';
import { KgaraCaseFinancialController } from './kgara-case-financial.controller';
import { RBAC_ANY_PERMISSIONS_KEY } from '../../auth/decorators/require-permissions.decorator';
import { ErpResource, ErpAction } from '@/v2/core/rbac-core';

describe('KgaraCaseFinancialController RBAC Permissions', () => {
  const reflector = new Reflector();

  it('addLinkedInvoice allows both GARAGE:UPDATE and INVOICES:UPDATE via RequireAnyPermissions', () => {
    const handler = KgaraCaseFinancialController.prototype.addLinkedInvoice;
    const perms = reflector.get(RBAC_ANY_PERMISSIONS_KEY, handler);

    expect(perms).toBeDefined();
    expect(perms).toEqual(
      expect.arrayContaining([
        { resource: ErpResource.GARAGE, action: ErpAction.UPDATE },
        { resource: ErpResource.GARAGE_DEBTS, action: ErpAction.UPDATE },
        { resource: ErpResource.GARAGE_DEBTS, action: ErpAction.CREATE },
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
        { resource: ErpResource.GARAGE_DEBTS, action: ErpAction.DELETE },
        { resource: ErpResource.GARAGE_DEBTS, action: ErpAction.UPDATE },
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
        { resource: ErpResource.GARAGE_DEBTS, action: ErpAction.UPDATE },
        { resource: ErpResource.INVOICES, action: ErpAction.UPDATE },
        { resource: ErpResource.BANK_STATEMENTS, action: ErpAction.UPDATE },
      ]),
    );
  });
});

describe('KgaraCaseFinancialController chiếu cấn trừ sang sổ nợ v2', () => {
  it('xóa settlement: tính lại vụ việc rồi gọi projectCase; projector lỗi không làm hỏng', async () => {
    const projector = {
      projectCase: jest.fn().mockRejectedValue(new Error('x')),
    };
    const caseQueryService = {
      recalculateCaseSettlementSummary: jest.fn().mockResolvedValue(undefined),
    };
    const controller = new KgaraCaseFinancialController(
      {} as never,
      {} as never,
      { delete: jest.fn().mockResolvedValue(undefined) } as never,
      {} as never,
      {} as never,
      {} as never,
      caseQueryService as never,
      { get: () => projector } as never,
    );
    const out = await controller.removeCaseSettlement(
      'case-1',
      '11111111-1111-4111-8111-111111111111',
    );
    expect(out).toEqual({ success: true });
    expect(projector.projectCase).toHaveBeenCalledWith('case-1');
  });
});
