import { FindOperator } from 'typeorm';
import { GarageInventoryBalance } from '../entities/garage-inventory-balance.entity';
import { GarageInventoryBalanceService } from './garage-inventory-balance.service';

function makeBalance(over: Partial<GarageInventoryBalance> = {}) {
  return Object.assign(new GarageInventoryBalance(), {
    qtyOnHand: '0',
    avgCost: '0',
    ...over,
  });
}

function fakeManager(rows: Record<string, GarageInventoryBalance | null>) {
  const lockOrder: string[] = [];
  const manager = {
    query: jest.fn().mockResolvedValue(undefined),
    findOne: jest.fn(
      async (
        _entity: unknown,
        options: { where: { itemCode: string }; lock: unknown },
      ) => {
        lockOrder.push(options.where.itemCode);
        return rows[options.where.itemCode] ?? null;
      },
    ),
    save: jest.fn(async (_entity: unknown, value: unknown) => value),
  };
  return { manager, lockOrder };
}

const move = (itemCode: string, qty: number, cost = 0) => ({
  itemCode,
  itemName: `Tên ${itemCode}`,
  unit: 'Cái',
  qty,
  cost,
});

describe('GarageInventoryBalanceService.apply', () => {
  it('cộng số lượng và cập nhật giá vốn khi cost > 0', async () => {
    const row = makeBalance({ itemCode: 'A', qtyOnHand: '3', avgCost: '10' });
    const { manager } = fakeManager({ A: row });
    await new GarageInventoryBalanceService().apply(manager as never, 'b1', [
      move('A', 2, 20),
    ]);
    expect(row.qtyOnHand).toBe('5');
    expect(row.avgCost).toBe('20');
    expect(manager.save).toHaveBeenCalledWith(GarageInventoryBalance, row);
  });

  it('giữ giá vốn cũ khi cost = 0', async () => {
    const row = makeBalance({ itemCode: 'A', qtyOnHand: '1', avgCost: '15' });
    const { manager } = fakeManager({ A: row });
    await new GarageInventoryBalanceService().apply(manager as never, 'b1', [
      move('A', 1, 0),
    ]);
    expect(row.avgCost).toBe('15');
  });

  it('tạo dòng bằng INSERT ... ON CONFLICT theo chỉ mục có chi nhánh trước khi khóa', async () => {
    const row = makeBalance({ itemCode: 'A' });
    const { manager } = fakeManager({ A: row });
    await new GarageInventoryBalanceService().apply(manager as never, 'b1', [
      move('A', 1),
    ]);
    const sql = manager.query.mock.calls[0][0] as string;
    expect(sql).toContain(
      'ON CONFLICT ("branch_id", "item_code") WHERE "branch_id" IS NOT NULL DO NOTHING',
    );
    expect(manager.query.mock.calls[0][1]).toEqual(['b1', 'A', 'Tên A', 'Cái']);
  });

  it('khóa theo itemCode tăng dần, không phụ thuộc thứ tự dòng phiếu', async () => {
    const rows = {
      A: makeBalance({ itemCode: 'A' }),
      B: makeBalance({ itemCode: 'B' }),
      C: makeBalance({ itemCode: 'C' }),
    };
    const { manager, lockOrder } = fakeManager(rows);
    await new GarageInventoryBalanceService().apply(manager as never, 'b1', [
      move('C', 1),
      move('A', 1),
      move('B', 1),
    ]);
    expect(lockOrder).toEqual(['A', 'B', 'C']);
  });

  it('chi nhánh null dùng chỉ mục IS NULL và khóa bằng IS NULL', async () => {
    const row = makeBalance({ itemCode: 'A' });
    const { manager } = fakeManager({ A: row });
    await new GarageInventoryBalanceService().apply(manager as never, null, [
      move('A', 1),
    ]);
    const sql = manager.query.mock.calls[0][0] as string;
    expect(sql).toContain(
      'ON CONFLICT ("item_code") WHERE "branch_id" IS NULL DO NOTHING',
    );
    const options = manager.findOne.mock.calls[0][1] as unknown as {
      where: { branchId: unknown };
    };
    const where = options.where;
    expect(where.branchId).toBeInstanceOf(FindOperator);
  });

  it('báo lỗi nếu sau khi tạo vẫn không đọc được dòng tồn', async () => {
    const { manager } = fakeManager({});
    await expect(
      new GarageInventoryBalanceService().apply(manager as never, 'b1', [
        move('A', 1),
      ]),
    ).rejects.toThrow('Thiếu dòng tồn sau khi tạo: A');
  });
});

describe('GarageInventoryBalanceService.revert', () => {
  it('trừ số lượng và không âm', async () => {
    const row = makeBalance({ itemCode: 'A', qtyOnHand: '2' });
    const { manager } = fakeManager({ A: row });
    await new GarageInventoryBalanceService().revert(manager as never, 'b1', [
      move('A', 5),
    ]);
    expect(row.qtyOnHand).toBe('0');
  });

  it('bỏ qua dòng tồn không tồn tại, không tạo mới', async () => {
    const { manager } = fakeManager({});
    await new GarageInventoryBalanceService().revert(manager as never, 'b1', [
      move('A', 1),
    ]);
    expect(manager.query).not.toHaveBeenCalled();
    expect(manager.save).not.toHaveBeenCalled();
  });
});
