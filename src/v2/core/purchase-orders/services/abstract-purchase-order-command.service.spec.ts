import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { PURCHASE_ORDER_STATUS } from '../contracts/purchase-order.contract';
import { BasePurchaseOrderEntity } from '../entities/base-purchase-order.entity';
import { BasePurchaseOrderLineEntity } from '../entities/base-purchase-order-line.entity';
import { PurchaseOrderEngine } from './purchase-order-engine.service';
import { PurchaseOrderNumberingService } from './purchase-order-numbering.service';
import {
  AbstractPurchaseOrderCommandService,
  PurchaseOrderEntityTarget,
} from './abstract-purchase-order-command.service';

// Lớp giả: không @Entity, chỉ dùng làm khóa nhận diện bảng trong manager giả.
class HeaderEntity extends BasePurchaseOrderEntity {}
class LineEntity extends BasePurchaseOrderLineEntity {
  purchaseOrderId!: string;
}

type Row = Record<string, unknown> & { id: string };

/** Manager giả trong bộ nhớ, đủ cho các lệnh mà command service dùng. */
function createFakeDataSource() {
  const headers = new Map<string, Row>();
  const lines = new Map<string, Row>();
  let seq = 0;
  const nextId = () => `id-${++seq}`;
  const tableOf = (target: unknown) =>
    target === HeaderEntity ? headers : lines;
  const matches = (row: Row, where: Record<string, unknown> = {}) =>
    Object.entries(where).every(([key, value]) => row[key] === value);

  const manager = {
    findOne: (target: unknown, opts: { where: Record<string, unknown> }) =>
      Promise.resolve(
        [...tableOf(target).values()].find((r) => matches(r, opts.where)) ??
          null,
      ),
    find: (target: unknown, opts: { where: Record<string, unknown> }) =>
      Promise.resolve(
        [...tableOf(target).values()]
          .filter((r) => matches(r, opts.where))
          .sort((a, b) => Number(a.lineNo) - Number(b.lineNo)),
      ),
    exists: (target: unknown, opts: { where: Record<string, unknown> }) =>
      Promise.resolve(
        [...tableOf(target).values()].some((r) => matches(r, opts.where)),
      ),
    create: (_target: unknown, data: Record<string, unknown>) => ({ ...data }),
    save: (first: unknown, second?: unknown) => {
      if (second === undefined) {
        const row = { id: nextId(), ...(first as Record<string, unknown>) };
        headers.set(row.id as string, row as Row);
        return Promise.resolve(row);
      }
      const saved = (second as Record<string, unknown>[]).map((data) => {
        const id = (data.id as string | undefined) ?? nextId();
        const row = { ...(lines.get(id) ?? {}), ...data, id } as Row;
        lines.set(id, row);
        return row;
      });
      return Promise.resolve(saved);
    },
    update: (
      target: unknown,
      criteria: Record<string, unknown>,
      changes: Record<string, unknown>,
    ) => {
      for (const row of tableOf(target).values()) {
        if (matches(row, criteria)) Object.assign(row, changes);
      }
      return Promise.resolve();
    },
    delete: (target: unknown, ids: string[]) => {
      ids.forEach((id) => tableOf(target).delete(id));
      return Promise.resolve();
    },
  };

  const dataSource = {
    transaction: (cb: (m: typeof manager) => Promise<unknown>) => cb(manager),
  } as unknown as DataSource;

  return { dataSource, manager, headers, lines };
}

class TestPurchaseOrderService extends AbstractPurchaseOrderCommandService<
  HeaderEntity,
  LineEntity
> {
  protected readonly target: PurchaseOrderEntityTarget<
    HeaderEntity,
    LineEntity
  > = {
    header: HeaderEntity,
    line: LineEntity,
    lineForeignKey: 'purchaseOrderId',
  };
  protected readonly numberPrefix = 'PO';
  cancelGuard: (h: HeaderEntity) => Promise<void> = () => Promise.resolve();
  linesHook = jest.fn();

  protected override assertCanCancel(header: HeaderEntity): Promise<void> {
    return this.cancelGuard(header);
  }

  protected override onLinesPersisted(
    _manager: unknown,
    _header: HeaderEntity,
    lines: LineEntity[],
  ): Promise<void> {
    this.linesHook(lines.length);
    return Promise.resolve();
  }
}

const USER_ID = '99999999-9999-9999-9999-999999999999';

function setup() {
  const fake = createFakeDataSource();
  const numbering = {
    nextNo: jest.fn().mockResolvedValue('PO-20261104-001'),
  } as unknown as PurchaseOrderNumberingService;
  const service = new TestPurchaseOrderService(
    fake.dataSource,
    new PurchaseOrderEngine(),
    numbering,
  );
  const seedHeader = (status: string, extra: Record<string, unknown> = {}) => {
    const row = {
      id: 'po-1',
      poNo: 'PO-OLD-001',
      status,
      isDeleted: false,
      ...extra,
    } as Row;
    fake.headers.set(row.id, row);
    return row;
  };
  const seedLine = (
    headerId: string,
    lineNo: number,
    qtyOrdered: string,
    qtyReceived = '0',
  ) => {
    const row = {
      id: `line-${headerId}-${lineNo}`,
      purchaseOrderId: headerId,
      lineNo,
      qtyOrdered,
      qtyReceived,
      unitPrice: '10.000',
      amount: '0.000',
    } as Row;
    fake.lines.set(row.id, row);
    return row;
  };
  return { ...fake, service, numbering, seedHeader, seedLine };
}

describe('AbstractPurchaseOrderCommandService', () => {
  describe('create', () => {
    it('tạo DRAFT, lấy createdBy từ tham số (JWT), sinh số qua numbering', async () => {
      const { service, numbering, headers } = setup();
      const result = await service.create(
        { orderDate: '2026-11-04', createdBy: 'hacker' } as never,
        USER_ID,
      );
      expect(result.poNo).toBe('PO-20261104-001');
      expect(numbering.nextNo).toHaveBeenCalledWith(
        expect.anything(),
        HeaderEntity,
        'PO',
        '2026-11-04',
      );
      const row = headers.get(result.id);
      expect(row?.status).toBe(PURCHASE_ORDER_STATUS.DRAFT);
      expect(row?.createdBy).toBe(USER_ID);
    });

    it('tính lại amount ở server, không tin amount client gửi (#8)', async () => {
      const { service, lines } = setup();
      const { id } = await service.create(
        {
          orderDate: '2026-11-04',
          lines: [{ qtyOrdered: '2', unitPrice: '1500', amount: '999999' }],
        },
        USER_ID,
      );
      const [line] = [...lines.values()].filter(
        (l) => l.purchaseOrderId === id,
      );
      expect(line.amount).toBe('3000.000');
      expect(line.qtyReceived).toBe('0');
    });

    it('từ chối số PO đã tồn tại (#5)', async () => {
      const { service, seedHeader } = setup();
      seedHeader('DRAFT', { poNo: 'PO-DUP-001' });
      await expect(
        service.create(
          { poNo: 'PO-DUP-001', orderDate: '2026-11-04' },
          USER_ID,
        ),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('từ chối số lượng không dương ở dòng (#8)', async () => {
      const { service } = setup();
      await expect(
        service.create(
          {
            orderDate: '2026-11-04',
            lines: [{ qtyOrdered: '0' }],
          },
          USER_ID,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('gọi hook onLinesPersisted sau khi ghi dòng', async () => {
      const { service } = setup();
      await service.create(
        { orderDate: '2026-11-04', lines: [{ qtyOrdered: '1' }] },
        USER_ID,
      );
      expect(service.linesHook).toHaveBeenCalledWith(1);
    });
  });

  describe('update', () => {
    it('từ chối sửa khi đã RECEIVED hoặc CANCELLED (H2)', async () => {
      const { service, seedHeader } = setup();
      seedHeader('RECEIVED');
      await expect(
        service.update('po-1', { remarks: 'x' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('không cho đổi trạng thái qua update (H3): status không nằm trong DTO', async () => {
      const { service, seedHeader, headers } = setup();
      seedHeader('DRAFT');
      await service.update('po-1', { remarks: 'ghi chú' });
      expect(headers.get('po-1')?.status).toBe('DRAFT');
      expect(headers.get('po-1')?.remarks).toBe('ghi chú');
    });

    it('giữ qtyReceived của dòng khớp theo vị trí', async () => {
      const { service, seedHeader, seedLine, lines } = setup();
      seedHeader('CONFIRMED');
      seedLine('po-1', 1, '5.000', '2.000');
      await service.update('po-1', {
        lines: [{ qtyOrdered: '8', unitPrice: '10' }],
      });
      const [line] = [...lines.values()].filter(
        (l) => l.purchaseOrderId === 'po-1',
      );
      expect(line.qtyReceived).toBe('2.000');
      expect(line.qtyOrdered).toBe('8.000');
    });

    it('từ chối đặt SL nhỏ hơn số đã nhận (H2)', async () => {
      const { service, seedHeader, seedLine } = setup();
      seedHeader('CONFIRMED');
      seedLine('po-1', 1, '5.000', '3.000');
      await expect(
        service.update('po-1', {
          lines: [{ qtyOrdered: '2', unitPrice: '1' }],
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('từ chối xóa dòng đã có số nhận (H2)', async () => {
      const { service, seedHeader, seedLine } = setup();
      seedHeader('PARTIAL_RECEIVED');
      seedLine('po-1', 1, '5.000', '1.000');
      seedLine('po-1', 2, '3.000', '1.000');
      await expect(
        service.update('po-1', {
          lines: [{ qtyOrdered: '5', unitPrice: '1' }],
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('xóa được dòng chưa nhận hàng ở cuối', async () => {
      const { service, seedHeader, seedLine, lines } = setup();
      seedHeader('APPROVED');
      seedLine('po-1', 1, '5.000', '0');
      seedLine('po-1', 2, '3.000', '0');
      await service.update('po-1', {
        lines: [{ qtyOrdered: '5', unitPrice: '1' }],
      });
      const remaining = [...lines.values()].filter(
        (l) => l.purchaseOrderId === 'po-1',
      );
      expect(remaining).toHaveLength(1);
    });

    it('từ chối đổi sang số PO đã tồn tại', async () => {
      const { service, seedHeader } = setup();
      seedHeader('DRAFT');
      seedHeader('DRAFT', { id: 'po-2', poNo: 'PO-TAKEN' });
      await expect(
        service.update('po-1', { poNo: 'PO-TAKEN' }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('không tìm thấy phiếu đã xóa mềm', async () => {
      const { service, seedHeader } = setup();
      seedHeader('DRAFT', { isDeleted: true });
      await expect(
        service.update('po-1', { remarks: 'x' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('approve / confirm / cancel (state machine)', () => {
    it('DRAFT → APPROVED', async () => {
      const { service, seedHeader, headers } = setup();
      seedHeader('DRAFT');
      await expect(service.approve('po-1')).resolves.toEqual({
        id: 'po-1',
        status: 'APPROVED',
      });
      expect(headers.get('po-1')?.status).toBe('APPROVED');
    });

    it('DRAFT → CONFIRMED trực tiếp', async () => {
      const { service, seedHeader } = setup();
      seedHeader('DRAFT');
      await expect(service.confirm('po-1')).resolves.toMatchObject({
        status: 'CONFIRMED',
      });
    });

    it('từ chối hủy khi còn DRAFT (H3)', async () => {
      const { service, seedHeader } = setup();
      seedHeader('DRAFT');
      await expect(service.cancel('po-1')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('từ chối approve khi đã CONFIRMED', async () => {
      const { service, seedHeader } = setup();
      seedHeader('CONFIRMED');
      await expect(service.approve('po-1')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('hủy gọi hook assertCanCancel; hook ném lỗi thì trạng thái giữ nguyên', async () => {
      const { service, seedHeader, headers } = setup();
      seedHeader('CONFIRMED');
      service.cancelGuard = () =>
        Promise.reject(new BadRequestException('Đã có phiếu nhập'));
      await expect(service.cancel('po-1')).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(headers.get('po-1')?.status).toBe('CONFIRMED');
    });

    it('hủy thành công khi hook cho phép', async () => {
      const { service, seedHeader, headers } = setup();
      seedHeader('APPROVED');
      await service.cancel('po-1');
      expect(headers.get('po-1')?.status).toBe('CANCELLED');
    });
  });

  describe('softDelete', () => {
    it('chỉ xóa được DRAFT, xóa mềm bằng isDeleted', async () => {
      const { service, seedHeader, headers } = setup();
      seedHeader('DRAFT');
      await service.softDelete('po-1');
      expect(headers.get('po-1')?.isDeleted).toBe(true);
    });

    it('từ chối xóa khi đã duyệt', async () => {
      const { service, seedHeader } = setup();
      seedHeader('APPROVED');
      await expect(service.softDelete('po-1')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });
  });

  describe('applyReceiptProgress', () => {
    it('nhận một phần → PARTIAL_RECEIVED', async () => {
      const { service, seedHeader, seedLine, manager, headers } = setup();
      seedHeader('CONFIRMED');
      const line = seedLine('po-1', 1, '4.000', '0');
      const status = await service.applyReceiptProgress(
        manager as never,
        'po-1',
        { [line.id as string]: 2 },
      );
      expect(status).toBe('PARTIAL_RECEIVED');
      expect(headers.get('po-1')?.status).toBe('PARTIAL_RECEIVED');
    });

    it('nhận đủ → RECEIVED', async () => {
      const { service, seedHeader, seedLine, manager } = setup();
      seedHeader('PARTIAL_RECEIVED');
      const line = seedLine('po-1', 1, '4.000', '2.000');
      const status = await service.applyReceiptProgress(
        manager as never,
        'po-1',
        { [line.id as string]: 4 },
      );
      expect(status).toBe('RECEIVED');
    });

    it('từ chối nhận vượt số đặt', async () => {
      const { service, seedHeader, seedLine, manager } = setup();
      seedHeader('CONFIRMED');
      const line = seedLine('po-1', 1, '4.000', '0');
      await expect(
        service.applyReceiptProgress(manager as never, 'po-1', {
          [line.id as string]: 5,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('từ chối khi phiếu còn DRAFT', async () => {
      const { service, seedHeader, manager } = setup();
      seedHeader('DRAFT');
      await expect(
        service.applyReceiptProgress(manager as never, 'po-1', {}),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });
});
