import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { BaseQueryPurchaseOrderDto } from './base-query-purchase-order.dto';
import { BaseCreatePurchaseOrderLineDto } from './base-create-purchase-order-line.dto';

const toQuery = (plain: Record<string, unknown>) =>
  plainToInstance(BaseQueryPurchaseOrderDto, plain);

describe('BaseQueryPurchaseOrderDto', () => {
  it('only_receivable="false" ra false, không bị coi là true (H1)', () => {
    expect(toQuery({ only_receivable: 'false' }).only_receivable).toBe(false);
    expect(validateSync(toQuery({ only_receivable: 'false' }))).toHaveLength(0);
  });

  it('only_receivable="true" và "1" ra true; không gửi thì để undefined', () => {
    expect(toQuery({ only_receivable: 'true' }).only_receivable).toBe(true);
    expect(toQuery({ only_receivable: '1' }).only_receivable).toBe(true);
    expect(toQuery({}).only_receivable).toBeUndefined();
  });

  it('pageSize vượt 200 bị từ chối (#10)', () => {
    const errors = validateSync(toQuery({ pageSize: 500 }));
    expect(errors.map((e) => e.property)).toContain('pageSize');
  });

  it('pageSize trong giới hạn được chấp nhận', () => {
    expect(validateSync(toQuery({ pageSize: 200 }))).toHaveLength(0);
  });

  it('supplier_id không phải UUID bị từ chối', () => {
    const errors = validateSync(toQuery({ supplier_id: 'abc' }));
    expect(errors.map((e) => e.property)).toContain('supplier_id');
  });
});

describe('BaseCreatePurchaseOrderLineDto', () => {
  it('qtyOrdered phải là chuỗi số; chặn giá trị chữ (#8)', () => {
    const line = plainToInstance(BaseCreatePurchaseOrderLineDto, {
      qtyOrdered: 'abc',
    });
    const errors = validateSync(line);
    expect(errors.map((e) => e.property)).toContain('qtyOrdered');
  });
});
