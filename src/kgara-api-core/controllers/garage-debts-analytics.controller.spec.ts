import { Reflector } from '@nestjs/core';
import {
  RBAC_ANY_PERMISSIONS_KEY,
  RBAC_PERMISSIONS_KEY,
} from '../../auth/decorators/require-permissions.decorator';
import { ErpAction, ErpResource } from '@/rbac-core/enums';
import { GarageDebtsAnalyticsController } from './garage-debts-analytics.controller';
import { KgaraCustomersController } from './kgara-customers.controller';
import { KgaraSuppliersController } from './kgara-suppliers.controller';
import { KgaraCaseFinancialController } from './kgara-case-financial.controller';

describe('Garage debts RBAC contracts', () => {
  const reflector = new Reflector();

  it('protects analytics endpoints with GARAGE_DEBTS:READ', () => {
    for (const handler of [
      GarageDebtsAnalyticsController.prototype.getDebtsAnalytics,
      GarageDebtsAnalyticsController.prototype.getTimeHorizonCases,
    ]) {
      expect(reflector.get(RBAC_PERMISSIONS_KEY, handler)).toEqual([
        { resource: ErpResource.GARAGE_DEBTS, action: ErpAction.READ },
      ]);
    }
  });

  it('protects customer and supplier debt endpoints with GARAGE_DEBTS:READ', () => {
    const debtHandlers = [
      KgaraCustomersController.prototype.getCustomersDebt,
      KgaraCustomersController.prototype.getCustomersDebtColumnOptions,
      KgaraCustomersController.prototype.getCasesByCustomer,
      KgaraSuppliersController.prototype.getSuppliersDebt,
      KgaraSuppliersController.prototype.getSuppliersDebtColumnOptions,
      KgaraSuppliersController.prototype.getCasesBySupplier,
    ];

    for (const handler of debtHandlers) {
      expect(reflector.get(RBAC_PERMISSIONS_KEY, handler)).toEqual([
        { resource: ErpResource.GARAGE_DEBTS, action: ErpAction.READ },
      ]);
    }
  });

  it('allows debt users to read shared case financial data', () => {
    const handlers = [
      KgaraCaseFinancialController.prototype.getCaseFinancialSummary,
      KgaraCaseFinancialController.prototype.getCaseSettlements,
    ];

    for (const handler of handlers) {
      expect(reflector.get(RBAC_ANY_PERMISSIONS_KEY, handler)).toEqual(
        expect.arrayContaining([
          { resource: ErpResource.GARAGE_DEBTS, action: ErpAction.READ },
        ]),
      );
    }
  });
});
