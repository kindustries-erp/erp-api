import { Reflector } from '@nestjs/core';
import { KgaraCaseFinancialController } from './kgara-case-financial.controller';
import { RBAC_ANY_PERMISSIONS_KEY } from '../../auth/decorators/require-permissions.decorator';
import { ErpResource, ErpAction } from '@/v2/core/rbac-core';
import { GARAGE_CASE_PROJECTOR } from '../hub/case-projector.port';

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

describe('KgaraCaseFinancialController liên kết hóa đơn của phiếu OJ', () => {
  const CASE_ID = '22222222-2222-4222-8222-222222222222';
  const LINK_ID = '33333333-3333-4333-8333-333333333333';

  function build(
    row: { classification: string; excludeFromDebt: boolean },
    hasInvoice: boolean,
  ) {
    const calls: string[] = [];
    const caseProjector = {
      projectCase: jest.fn(async () => void calls.push('case')),
    };
    const ledgerProjector = {
      projectCase: jest.fn(async () => void calls.push('ledger')),
    };
    const manager = {
      findOne: jest.fn().mockResolvedValue({ id: CASE_ID, ...row }),
      query: jest.fn().mockResolvedValue([{ has: hasInvoice }]),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    const linkRepo = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn((d) => d),
      save: jest.fn(async (d) => d),
      delete: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    const controller = new KgaraCaseFinancialController(
      { manager } as never,
      {} as never,
      {} as never,
      linkRepo as never,
      {} as never,
      {} as never,
      {} as never,
      {
        get: (token: unknown) =>
          token === GARAGE_CASE_PROJECTOR ? caseProjector : ledgerProjector,
      } as never,
    );
    return { controller, manager, linkRepo, calls };
  }

  it('gắn hóa đơn đầu ra: bật công nợ rồi chiếu V2 trước sổ nợ', async () => {
    const ctx = build({ classification: 'OJ', excludeFromDebt: true }, true);
    await ctx.controller.addLinkedInvoice(CASE_ID, {
      invoiceId: 'inv-1',
      linkType: 'OUT',
    });
    expect(ctx.manager.update).toHaveBeenCalledWith(
      expect.anything(),
      CASE_ID,
      { excludeFromDebt: false },
    );
    expect(ctx.calls).toEqual(['case', 'ledger']);
  });

  it('gỡ hóa đơn cuối cùng: loại lại khỏi công nợ', async () => {
    const ctx = build({ classification: 'OJ', excludeFromDebt: false }, false);
    ctx.linkRepo.findOne.mockResolvedValue({ id: LINK_ID });
    await ctx.controller.removeLinkedInvoice(CASE_ID, LINK_ID);
    expect(ctx.manager.update).toHaveBeenCalledWith(
      expect.anything(),
      CASE_ID,
      { excludeFromDebt: true },
    );
    expect(ctx.calls).toEqual(['case', 'ledger']);
  });

  it('phiếu không phải OJ: không đổi cờ, không chiếu thêm', async () => {
    const ctx = build(
      { classification: 'SUA_CHUA_CHUNG', excludeFromDebt: false },
      true,
    );
    await ctx.controller.addLinkedInvoice(CASE_ID, {
      invoiceId: 'inv-1',
      linkType: 'OUT',
    });
    expect(ctx.manager.update).not.toHaveBeenCalled();
    expect(ctx.calls).toEqual([]);
  });
});
