import { DataSource } from 'typeorm';
import { BaseCreatePurchaseOrderDto } from './dto';
import { BasePurchaseOrderEntity } from './entities/base-purchase-order.entity';
import { BasePurchaseOrderLineEntity } from './entities/base-purchase-order-line.entity';
import { AbstractPurchaseOrderCommandService } from './services/abstract-purchase-order-command.service';
import { PurchaseOrderEngine } from './services/purchase-order-engine.service';
import { PurchaseOrderNumberingService } from './services/purchase-order-numbering.service';

/**
 * AC-6: chứng minh một lớp kiểu v1 kế thừa được lõi mà KHÔNG sửa lõi.
 * Lớp này mô phỏng việc refactor purchase-orders-core sau này: entity thêm
 * cột riêng, service chỉ khai báo bảng, tiền tố và hook.
 */
class LegacyLikePurchaseOrder extends BasePurchaseOrderEntity {
  legacyNote: string | null;
}
class LegacyLikePurchaseOrderLine extends BasePurchaseOrderLineEntity {
  purchaseOrderId!: string;
}

class LegacyLikePurchaseOrderService extends AbstractPurchaseOrderCommandService<
  LegacyLikePurchaseOrder,
  LegacyLikePurchaseOrderLine
> {
  protected readonly target = {
    header: LegacyLikePurchaseOrder,
    line: LegacyLikePurchaseOrderLine,
    lineForeignKey: 'purchaseOrderId',
  };
  protected readonly numberPrefix = 'PO';

  protected override extraHeaderFields(dto: {
    remarks?: string;
  }): Record<string, unknown> {
    return { legacyNote: dto.remarks ?? null };
  }
}

/** Manager giả tối thiểu, đủ để chạy các lệnh ghi của lõi. */
function createInMemoryDataSource() {
  const headers = new Map<string, Record<string, unknown>>();
  const lines = new Map<string, Record<string, unknown>>();
  let seq = 0;
  const tableOf = (target: unknown) =>
    target === LegacyLikePurchaseOrder ? headers : lines;
  const matches = (row: Record<string, unknown>, where: object = {}) =>
    Object.entries(where).every(([k, v]) => row[k] === v);

  const manager = {
    findOne: (t: unknown, o: { where: object }) =>
      Promise.resolve(
        [...tableOf(t).values()].find((r) => matches(r, o.where)) ?? null,
      ),
    find: (t: unknown, o: { where: object }) =>
      Promise.resolve(
        [...tableOf(t).values()].filter((r) => matches(r, o.where)),
      ),
    exists: (t: unknown, o: { where: object }) =>
      Promise.resolve(
        [...tableOf(t).values()].some((r) => matches(r, o.where)),
      ),
    create: (_t: unknown, data: Record<string, unknown>) => ({ ...data }),
    save: (first: unknown, second?: unknown) => {
      if (second === undefined) {
        const row = {
          id: `h-${++seq}`,
          ...(first as Record<string, unknown>),
        };
        headers.set(row.id, row);
        return Promise.resolve(row);
      }
      return Promise.resolve(
        (second as Record<string, unknown>[]).map((data) => {
          const id = (data.id as string | undefined) ?? `l-${++seq}`;
          const row = { ...(lines.get(id) ?? {}), ...data, id };
          lines.set(id, row);
          return row;
        }),
      );
    },
    update: (
      t: unknown,
      criteria: object,
      changes: Record<string, unknown>,
    ) => {
      for (const row of tableOf(t).values()) {
        if (matches(row, criteria)) Object.assign(row, changes);
      }
      return Promise.resolve();
    },
    delete: (t: unknown, ids: string[]) => {
      ids.forEach((id) => tableOf(t).delete(id));
      return Promise.resolve();
    },
  };

  return {
    dataSource: {
      transaction: (cb: (m: typeof manager) => Promise<unknown>) => cb(manager),
    } as unknown as DataSource,
    headers,
    lines,
  };
}

describe('Kế thừa lõi PO (AC-6)', () => {
  function setup() {
    const memory = createInMemoryDataSource();
    const numbering = {
      nextNo: jest.fn().mockResolvedValue('PO-20261104-007'),
    } as unknown as PurchaseOrderNumberingService;
    const service = new LegacyLikePurchaseOrderService(
      memory.dataSource,
      new PurchaseOrderEngine(),
      numbering,
    );
    return { ...memory, service, numbering };
  }

  it('tạo phiếu qua lõi: số từ numbering, DRAFT, amount tính ở server, hook extraHeaderFields áp dụng', async () => {
    const { service, headers, lines } = setup();
    const dto: BaseCreatePurchaseOrderDto = {
      orderDate: '2026-11-04',
      remarks: 'từ v1',
      lines: [{ qtyOrdered: '3', unitPrice: '100', amount: '1' }],
    };
    const { id, poNo } = await service.create(dto, 'user-7');

    expect(poNo).toBe('PO-20261104-007');
    const header = headers.get(id);
    expect(header?.status).toBe('DRAFT');
    expect(header?.createdBy).toBe('user-7');
    expect(header?.legacyNote).toBe('từ v1');
    const [line] = [...lines.values()];
    expect(line.amount).toBe('300.000');
  });

  it('vòng đời approve → cancel đi qua state machine của lõi', async () => {
    const { service, headers } = setup();
    const { id } = await service.create({ orderDate: '2026-11-04' }, 'u');

    await service.approve(id);
    expect(headers.get(id)?.status).toBe('APPROVED');

    await service.cancel(id);
    expect(headers.get(id)?.status).toBe('CANCELLED');
  });

  it('không đổi được status qua update, kể cả khi client gửi status (H3)', async () => {
    const { service, headers } = setup();
    const { id } = await service.create({ orderDate: '2026-11-04' }, 'u');

    await service.update(id, { status: 'CANCELLED' } as never);
    expect(headers.get(id)?.status).toBe('DRAFT');
  });

  it('khóa đúng: phiếu RECEIVED không sửa được qua lõi (H2)', async () => {
    const { service, headers } = setup();
    const { id } = await service.create({ orderDate: '2026-11-04' }, 'u');
    headers.get(id)!.status = 'RECEIVED';

    await expect(service.update(id, { remarks: 'x' })).rejects.toThrow(
      'Không thể sửa phiếu',
    );
  });
});
