import { DataSource, EntityManager } from 'typeorm';
import { PurchaseOrderEngine } from '@/v2/core/purchase-orders/services/purchase-order-engine.service';
import { PurchaseOrderNumberingService } from '@/v2/core/purchase-orders/services/purchase-order-numbering.service';
import { GaragePurchaseOrder } from '../entities/garage-purchase-order.entity';
import { GaragePurchaseOrderLine } from '../entities/garage-purchase-order-line.entity';
import { GaragePurchaseOrderCommandService } from './garage-purchase-order-command.service';

function setup() {
  const dataSource = {} as DataSource;
  const numbering = {
    nextNo: jest.fn().mockResolvedValue('GPO-20261104-001'),
  } as unknown as PurchaseOrderNumberingService;
  return new GaragePurchaseOrderCommandService(
    dataSource,
    new PurchaseOrderEngine(),
    numbering,
  );
}

describe('GaragePurchaseOrderCommandService', () => {
  it('dùng tiền tố GPO và bảng garage', () => {
    const service = setup() as unknown as {
      target: { header: unknown; lineForeignKey: string };
      numberPrefix: string;
    };
    expect(service.numberPrefix).toBe('GPO');
    expect(service.target.header).toBe(GaragePurchaseOrder);
    expect(service.target.lineForeignKey).toBe('garagePurchaseOrderId');
  });

  it('gộp chi nhánh và tên NCC vào header, bỏ qua trường client không gửi', () => {
    const service = setup() as unknown as {
      extraHeaderFields(dto: Record<string, unknown>): Record<string, unknown>;
    };
    expect(
      service.extraHeaderFields({
        branchId: '44444444-4444-4444-4444-444444444444',
        branchName: 'Chi nhánh 1',
      }),
    ).toEqual({
      branchId: '44444444-4444-4444-4444-444444444444',
      branchName: 'Chi nhánh 1',
    });
    expect(service.extraHeaderFields({})).toEqual({});
  });

  it('ghi total_amount = tổng amount dòng (2 chữ số) trong cùng transaction', async () => {
    const service = setup() as unknown as {
      onLinesPersisted(
        m: EntityManager,
        h: GaragePurchaseOrder,
        l: GaragePurchaseOrderLine[],
      ): Promise<void>;
    };
    const update = jest.fn().mockResolvedValue({ affected: 1 });
    const manager = { update } as unknown as EntityManager;
    const lines = [
      { amount: '3000.000' },
      { amount: null },
      { amount: '250.500' },
    ] as GaragePurchaseOrderLine[];

    await service.onLinesPersisted(
      manager,
      { id: 'gpo-1' } as GaragePurchaseOrder,
      lines,
    );

    expect(update).toHaveBeenCalledWith(
      GaragePurchaseOrder,
      { id: 'gpo-1' },
      { totalAmount: '3250.50' },
    );
  });
});
