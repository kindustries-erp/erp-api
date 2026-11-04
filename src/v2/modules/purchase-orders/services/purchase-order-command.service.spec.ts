import { DataSource } from 'typeorm';
import { DocumentDependenciesCoreService } from '@/document-dependencies-core/document-dependencies-core.service';
import { PurchaseOrderEngine } from '@/v2/core/purchase-orders/services/purchase-order-engine.service';
import { PurchaseOrderNumberingService } from '@/v2/core/purchase-orders/services/purchase-order-numbering.service';
import { PurchaseOrder } from '../entities/purchase-order.entity';
import { PurchaseOrderCommandService } from './purchase-order-command.service';

describe('PurchaseOrderCommandService (hook hủy)', () => {
  it('hủy phải kiểm tra phụ thuộc với module purchase_orders (như v1)', async () => {
    const checkDependencies = jest.fn().mockResolvedValue(undefined);
    const dependencies = {
      checkDependencies,
    } as unknown as DocumentDependenciesCoreService;
    const service = new PurchaseOrderCommandService(
      {} as DataSource,
      new PurchaseOrderEngine(),
      {} as PurchaseOrderNumberingService,
      dependencies,
    );

    const header = { id: 'po-9' } as PurchaseOrder;
    // Gọi hook được bảo vệ qua ép kiểu để kiểm tra đúng luật hủy.
    await (
      service as unknown as {
        assertCanCancel(h: PurchaseOrder): Promise<void>;
      }
    ).assertCanCancel(header);

    expect(checkDependencies).toHaveBeenCalledWith('purchase_orders', 'po-9');
  });

  it('phụ thuộc còn thì hủy bị chặn (lỗi được truyền lên)', async () => {
    const dependencies = {
      checkDependencies: jest
        .fn()
        .mockRejectedValue(new Error('Đã có phiếu nhập')),
    } as unknown as DocumentDependenciesCoreService;
    const service = new PurchaseOrderCommandService(
      {} as DataSource,
      new PurchaseOrderEngine(),
      {} as PurchaseOrderNumberingService,
      dependencies,
    );
    await expect(
      (
        service as unknown as {
          assertCanCancel(h: PurchaseOrder): Promise<void>;
        }
      ).assertCanCancel({ id: 'po-1' } as PurchaseOrder),
    ).rejects.toThrow('Đã có phiếu nhập');
  });
});
