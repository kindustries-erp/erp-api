import { IsNull } from 'typeorm';
import { roundTo, toNumber } from '../helpers/decimal.helper';
import type { CostingContext, CostingStrategy } from './costing.types';

/**
 * FIFO theo lớp giá: mỗi lần nhập tạo một lớp; xuất tiêu lớp cũ nhất trước.
 * Giá trị tồn luôn bằng tổng giá trị các lớp còn lại.
 */
export const fifoStrategy: CostingStrategy = {
  method: 'FIFO',

  async receive(
    ctx: CostingContext,
    qty: number,
    unitCost: number,
  ): Promise<void> {
    const { balance, manager, transactionDate, tables } = ctx;
    await manager.getRepository(tables.costLayer).insert({
      ledgerScope: balance.ledgerScope,
      branchId: balance.branchId,
      itemCode: balance.itemCode,
      qtyRemaining: String(qty),
      unitCost: String(roundTo(unitCost, 2)),
      receivedAt: transactionDate,
    });
    const qty1 = roundTo(toNumber(balance.qtyOnHand) + qty, 3);
    const value1 = roundTo(
      toNumber(balance.inventoryValue) + qty * unitCost,
      2,
    );
    setBalance(balance, qty1, value1);
  },

  async issue(ctx: CostingContext, qty: number): Promise<number> {
    const consumedValue = await consumeLayers(ctx, qty);
    const { balance } = ctx;
    const qty1 = roundTo(toNumber(balance.qtyOnHand) - qty, 3);
    const value1 =
      qty1 > 0
        ? roundTo(toNumber(balance.inventoryValue) - consumedValue, 2)
        : 0;
    setBalance(balance, qty1, value1);
    return roundTo(consumedValue / qty, 2);
  },

  async withdrawReceived(
    ctx: CostingContext,
    qty: number,
    recordedUnitCost: number,
  ): Promise<number> {
    // FIFO bỏ đúng các lớp còn lại (cũ nhất trước): giá trị bỏ là giá của các lớp đó, không phải giá đã nhập.
    return fifoStrategy.issue(ctx, qty);
  },
};

/** Tiêu `qty` từ các lớp cũ nhất, trả về tổng giá trị đã tiêu. Engine đã khóa số dư nên không có lớp nào bị tranh chấp. */
async function consumeLayers(
  ctx: CostingContext,
  qty: number,
): Promise<number> {
  const { balance, manager, tables } = ctx;
  const layers = await manager.getRepository(tables.costLayer).find({
    where: {
      ledgerScope: balance.ledgerScope,
      branchId: balance.branchId ?? IsNull(),
      itemCode: balance.itemCode,
    },
    order: { receivedAt: 'ASC', id: 'ASC' },
  });

  let need = qty;
  let value = 0;
  for (const layer of layers) {
    if (need <= 0) break;
    const available = toNumber(layer.qtyRemaining);
    if (available <= 0) continue;
    const take = Math.min(available, need);
    value += take * toNumber(layer.unitCost);
    layer.qtyRemaining = String(roundTo(available - take, 3));
    need = roundTo(need - take, 3);
    await manager.save(tables.costLayer, layer);
  }
  if (need > 0) {
    throw new Error(
      `Lớp giá FIFO không đủ cho ${balance.itemCode}: thiếu ${need}`,
    );
  }
  return value;
}

function setBalance(
  balance: CostingContext['balance'],
  qty1: number,
  value1: number,
): void {
  balance.qtyOnHand = String(qty1);
  balance.inventoryValue = String(value1);
  balance.avgCost = String(qty1 > 0 ? roundTo(value1 / qty1, 2) : 0);
}
