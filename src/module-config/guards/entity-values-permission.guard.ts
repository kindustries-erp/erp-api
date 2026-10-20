import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { RbacCoreService } from '../../rbac-core/rbac-core.service';
import { ErpAction, ErpResource } from '../../rbac-core/enums';

/** entityType (EAV) → resource RBAC của module sở hữu thực thể. */
export const ENTITY_TYPE_RESOURCE: Readonly<Record<string, ErpResource>> = {
  GARAGE_CASE: ErpResource.GARAGE,
  INVOICE_IN: ErpResource.INVOICES,
  INVOICE_OUT: ErpResource.INVOICES,
  BANK_TXN: ErpResource.BANK_STATEMENTS,
  BOM: ErpResource.BOM,
  PRODUCTION: ErpResource.PRODUCTION,
  GOODS_RECEIPT: ErpResource.GOODS_RECEIPTS,
  GOODS_ISSUE: ErpResource.GOODS_ISSUES,
  INVENTORY_ADJUSTMENT: ErpResource.INVENTORY_ADJUSTMENTS,
  INVENTORY_ITEM: ErpResource.INVENTORY_ITEMS,
};

/**
 * Ghi giá trị thuộc tính của 1 thực thể cần quyền UPDATE của module sở hữu.
 * entityType chưa đăng ký → yêu cầu custom_fields:manage (không mở cửa mặc định).
 */
@Injectable()
export class EntityValuesPermissionGuard implements CanActivate {
  constructor(private readonly rbac: RbacCoreService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const userId = request.user?.sub;
    if (!userId) {
      throw new ForbiddenException('Bạn không có quyền thực hiện thao tác này');
    }

    const entityType = String(request.params?.entityType ?? '')
      .trim()
      .toUpperCase();
    const resource = ENTITY_TYPE_RESOURCE[entityType];

    const allowed = resource
      ? await this.rbac.hasPermission(userId, resource, ErpAction.UPDATE)
      : await this.rbac.hasPermission(
          userId,
          ErpResource.CUSTOM_FIELDS,
          ErpAction.MANAGE,
        );

    if (!allowed) {
      throw new ForbiddenException('Bạn không có quyền thực hiện thao tác này');
    }
    return true;
  }
}
