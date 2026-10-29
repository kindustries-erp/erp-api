import { describe, expect, it } from '@jest/globals';
import { ErpInvoicesCoreController } from './erp-invoices-core.controller';
import { RBAC_PERMISSIONS_KEY } from '../auth/decorators/require-permissions.decorator';
import { ErpAction, ErpResource } from '@/rbac-core/enums';

/** Kiểm tra metadata RBAC của các endpoint GDT portal, không dựng module */
const permissionsOf = (method: keyof ErpInvoicesCoreController) =>
  Reflect.getMetadata(
    RBAC_PERMISSIONS_KEY,
    ErpInvoicesCoreController.prototype[method] as object,
  );

describe('ErpInvoicesCoreController - RBAC portal GDT', () => {
  it('sync-detail yêu cầu quyền cập nhật hóa đơn', () => {
    expect(permissionsOf('syncDetail')).toEqual([
      { resource: ErpResource.INVOICES, action: ErpAction.UPDATE },
    ]);
  });

  it('portal/progress (SSE) yêu cầu quyền đọc hóa đơn', () => {
    expect(permissionsOf('progress')).toEqual([
      { resource: ErpResource.INVOICES, action: ErpAction.READ },
    ]);
  });
});
