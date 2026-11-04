import { DataSource } from 'typeorm';
import { RBAC_PERMISSIONS_KEY } from '@/auth/decorators/require-permissions.decorator';
import { ErpAction } from '@/rbac-core/enums/erp-action.enum';
import { ErpResource } from '@/rbac-core/enums/erp-resource.enum';
import { GaragePurchaseOrderController } from './controllers/garage-purchase-order.controller';
import { GaragePurchaseOrder } from './entities/garage-purchase-order.entity';
import { GaragePurchaseOrderLine } from './entities/garage-purchase-order-line.entity';
import { GaragePurchaseOrdersService } from './garage-purchase-orders.service';

/**
 * AC-4: PO garage có quyền riêng, route riêng, và response đúng khuôn PO
 * cộng chi nhánh. Tổng tiền đọc từ cột total_amount đã lưu.
 */
describe('API v2 garage-purchase-orders: quyền và hợp đồng (AC-4)', () => {
  it('route và quyền dùng resource garage_purchase_orders, không dùng quyền PO core', () => {
    const path = Reflect.getMetadata(
      'path',
      GaragePurchaseOrderController,
    ) as string;
    expect(path).toBe('api/v2/garage-purchase-orders');

    const resources = new Set<string>();
    for (const name of Object.getOwnPropertyNames(
      GaragePurchaseOrderController.prototype,
    )) {
      const method = (
        GaragePurchaseOrderController.prototype as unknown as Record<
          string,
          unknown
        >
      )[name];
      if (typeof method !== 'function') continue;
      const perms = Reflect.getMetadata(RBAC_PERMISSIONS_KEY, method) as
        | { resource: string; action: string }[]
        | undefined;
      perms?.forEach((p) => resources.add(p.resource));
    }
    expect([...resources]).toEqual([ErpResource.GARAGE_PURCHASE_ORDERS]);
    expect(ErpResource.GARAGE_PURCHASE_ORDERS).toBe('garage_purchase_orders');
    expect(ErpAction.UPDATE).toBeDefined();
  });

  describe('facade', () => {
    const header = Object.assign(new GaragePurchaseOrder(), {
      id: 'gpo-1',
      poNo: 'GPO-20261104-001',
      supplierId: null,
      supplierName: 'NCC garage',
      branchId: '44444444-4444-4444-4444-444444444444',
      branchName: 'Chi nhánh 1',
      orderDate: new Date('2026-11-04T00:00:00Z'),
      expectedDate: null,
      status: 'DRAFT',
      paymentStatus: 'UNPAID',
      remarks: null,
      supplierInvoiceNo: null,
      createdBy: 'user-1',
      isDeleted: false,
      totalAmount: '3250.50',
      createdAt: new Date('2026-11-04T01:00:00Z'),
      updatedAt: new Date('2026-11-04T01:00:00Z'),
    });
    const lines = [
      Object.assign(new GaragePurchaseOrderLine(), {
        id: 'l1',
        lineNo: 1,
        itemId: null,
        itemCode: 'G1',
        itemName: 'Lọc dầu',
        description: null,
        qtyOrdered: '1.000',
        qtyReceived: '0.000',
        unitPrice: '3250.500',
        amount: '3250.500',
      }),
    ];

    function setup() {
      const queries = {
        findOne: jest.fn().mockResolvedValue({ header, lines }),
      };
      const commands = {
        create: jest.fn().mockResolvedValue({ id: 'gpo-1', poNo: 'x' }),
      };
      const dataSource = {
        transaction: (cb: (m: unknown) => Promise<unknown>) => cb({}),
      } as unknown as DataSource;
      const service = new GaragePurchaseOrdersService(
        commands as never,
        queries as never,
        {} as never,
        dataSource,
      );
      return { service, commands };
    }

    it('findOne trả PO garage với chi nhánh và totalAmount đã lưu', async () => {
      const { service } = setup();
      const result = await service.findOne('gpo-1');
      expect(result.message).toBe('Lấy thông tin thành công');
      expect(result.data).toMatchObject({
        id: 'gpo-1',
        poNo: 'GPO-20261104-001',
        supplierName: 'NCC garage',
        branchId: '44444444-4444-4444-4444-444444444444',
        branchName: 'Chi nhánh 1',
        totalAmount: 3250.5,
        inventoryStatus: 'NOT_RECEIVED',
      });
      expect(result.data).not.toHaveProperty('isDeleted');
    });

    it('create truyền userId từ JWT xuống lệnh ghi', async () => {
      const { service, commands } = setup();
      await service.create({ orderDate: '2026-11-04' } as never, 'user-1');
      expect(commands.create).toHaveBeenCalledWith(
        { orderDate: '2026-11-04' },
        'user-1',
      );
    });
  });
});
