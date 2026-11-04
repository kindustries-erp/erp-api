import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { BaseQueryPurchaseOrderDto } from '../dto';
import { BasePurchaseOrderEntity } from '../entities/base-purchase-order.entity';
import { BasePurchaseOrderLineEntity } from '../entities/base-purchase-order-line.entity';
import { PurchaseOrderEntityTarget } from './abstract-purchase-order-command.service';
import { AbstractPurchaseOrderQueryService } from './abstract-purchase-order-query.service';

class HeaderEntity extends BasePurchaseOrderEntity {}
class LineEntity extends BasePurchaseOrderLineEntity {
  purchaseOrderId!: string;
}

/**
 * Query builder giả: ghi lại điều kiện, sắp xếp và tham số để kiểm tra SQL
 * được sinh ra. subQuery() trả về một builder khác, getQuery() gom điều kiện.
 */
class FakeQb {
  wheres: string[] = [];
  orders: Array<[string, string]> = [];
  params: Record<string, unknown> = {};

  constructor(
    private readonly headers: { id: string }[] = [],
    private readonly one: unknown = null,
  ) {}

  where(sql: string, params?: Record<string, unknown>) {
    return this.andWhere(sql, params);
  }
  andWhere(sql: string, params?: Record<string, unknown>) {
    this.wheres.push(sql);
    Object.assign(this.params, params ?? {});
    return this;
  }
  orderBy(sql?: string, direction?: string) {
    if (sql) this.orders.push([sql, direction ?? 'ASC']);
    return this;
  }
  addOrderBy(sql: string, direction?: string) {
    return this.orderBy(sql, direction);
  }
  setParameters(params: Record<string, unknown>) {
    Object.assign(this.params, params);
    return this;
  }
  subQuery() {
    return new FakeQb();
  }
  getQuery() {
    return `(${this.wheres.join(' AND ')})`;
  }
  getParameters() {
    return this.params;
  }
  select() {
    return this;
  }
  addSelect() {
    return this;
  }
  from() {
    return this;
  }
  groupBy() {
    return this;
  }
  clone() {
    return this;
  }
  offset() {
    return this;
  }
  limit() {
    return this;
  }
  skip() {
    return this;
  }
  take() {
    return this;
  }
  getCount() {
    return Promise.resolve(this.headers.length);
  }
  getMany() {
    return Promise.resolve(this.headers);
  }
  getOne() {
    return Promise.resolve(this.one);
  }
  getRawOne() {
    return Promise.resolve({ totalAmount: 0 });
  }
  getRawMany() {
    return Promise.resolve([]);
  }
}

class TestQueryService extends AbstractPurchaseOrderQueryService<
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
}

function setup(
  options: {
    headers?: { id: string }[];
    one?: unknown;
    lines?: unknown[];
  } = {},
) {
  let last = new FakeQb();
  const lineRows = options.lines ?? [];
  const dataSource = {
    createQueryBuilder: jest.fn(() => {
      last = new FakeQb(options.headers ?? [], options.one ?? null);
      return last;
    }),
    getMetadata: () => ({
      tableName: 'erp_purchase_order_lines',
      findColumnWithPropertyName: () => ({ databaseName: 'purchase_order_id' }),
    }),
    getRepository: () => ({ find: jest.fn(() => Promise.resolve(lineRows)) }),
  } as unknown as DataSource;
  const service = new TestQueryService(dataSource);
  return { service, qb: () => last };
}

describe('AbstractPurchaseOrderQueryService', () => {
  it('luôn loại phiếu đã xóa mềm', async () => {
    const { service, qb } = setup();
    await service.list({} as BaseQueryPurchaseOrderDto);
    expect(qb().wheres).toContain('po.is_deleted = :notDeleted');
    expect(qb().params.notDeleted).toBe(false);
  });

  it('only_receivable=true dùng EXISTS trên dòng, so SL đặt với SL đã nhận (H1)', async () => {
    const { service, qb } = setup();
    await service.list({ only_receivable: true } as BaseQueryPurchaseOrderDto);
    const sql = qb().wheres.join(' ');
    expect(sql).toContain('EXISTS');
    expect(sql).toContain('pl.purchase_order_id = po.id');
    expect(sql).toContain(
      'CAST(pl.qty_ordered AS NUMERIC) > CAST(pl.qty_received AS NUMERIC)',
    );
  });

  it('only_receivable=false không thêm điều kiện dòng (H1)', async () => {
    const { service, qb } = setup();
    await service.list({ only_receivable: false } as BaseQueryPurchaseOrderDto);
    expect(qb().wheres.join(' ')).not.toContain('EXISTS');
  });

  it('inventory_item_id lọc theo item trên dòng', async () => {
    const { service, qb } = setup();
    await service.list({
      inventory_item_id: 'item-1',
    } as BaseQueryPurchaseOrderDto);
    expect(qb().params.itemId).toBe('item-1');
  });

  it('sắp xếp theo cột trong whitelist, giảm dần khi có dấu -', async () => {
    const { service, qb } = setup();
    await service.list({ sort: '-totalAmount' } as BaseQueryPurchaseOrderDto);
    expect(qb().orders[0][1]).toBe('DESC');
    expect(qb().orders[0][0]).toContain('SUM');
  });

  it('sort không hợp lệ rơi về mặc định created_at DESC', async () => {
    const { service, qb } = setup();
    await service.list({
      sort: 'po_no; DROP TABLE x',
    } as BaseQueryPurchaseOrderDto);
    expect(qb().orders[0]).toEqual(['po.created_at', 'DESC']);
  });

  it('gom dòng về đúng phiếu, giữ thứ tự của phiếu', async () => {
    const { service } = setup({
      headers: [{ id: 'a' }, { id: 'b' }],
      lines: [
        { purchaseOrderId: 'a', lineNo: 1 },
        { purchaseOrderId: 'a', lineNo: 2 },
      ],
    });
    const result = await service.list({} as BaseQueryPurchaseOrderDto);
    expect(result.items[0].lines).toHaveLength(2);
    expect(result.items[1].lines).toHaveLength(0);
    expect(result.total).toBe(2);
  });

  it('columnOptions từ chối cột không có trong whitelist', async () => {
    const { service } = setup();
    await expect(
      service.columnOptions('no_such_column', {} as BaseQueryPurchaseOrderDto, {
        page: 1,
        pageSize: 20,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('findOne báo lỗi khi không có phiếu', async () => {
    const { service } = setup({ one: null });
    await expect(service.findOne('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
