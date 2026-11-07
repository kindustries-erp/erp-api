import { roundTo, toNumber } from '../helpers/decimal.helper';
import type { CostingContext, CostingStrategy } from './costing.types';

/**
 * Bình quân gia quyền: giá vốn đơn vị = giá trị tồn / số lượng tồn, cập nhật mỗi lần nhập.
 * Xuất lấy giá bình quân hiện tại; giá trị và số lượng giảm theo đúng giá đó.
 */
export const weightedAvgStrategy: CostingStrategy = {
  method: 'WEIGHTED_AVG',

  async receive(
    ctx: CostingContext,
    qty: number,
    unitCost: number,
  ): Promise<void> {
    const { balance } = ctx;
    const qty0 = toNumber(balance.qtyOnHand);
    const value0 = toNumber(balance.inventoryValue);
    const qty1 = roundTo(qty0 + qty, 3);
    const value1 = roundTo(value0 + qty * unitCost, 2);
    balance.qtyOnHand = String(qty1);
    balance.inventoryValue = String(value1);
    balance.avgCost = String(
      qty1 > 0 ? roundTo(value1 / qty1, 2) : roundTo(unitCost, 2),
    );
  },

  async issue(ctx: CostingContext, qty: number): Promise<number> {
    const { balance } = ctx;
    const qty0 = toNumber(balance.qtyOnHand);
    const value0 = toNumber(balance.inventoryValue);
    const unitCost =
      qty0 > 0 ? roundTo(value0 / qty0, 2) : toNumber(balance.avgCost);
    applyDecrease(balance, qty0, value0, qty, qty * unitCost);
    return unitCost;
  },

  async withdrawReceived(
    ctx: CostingContext,
    qty: number,
    recordedUnitCost: number,
  ): Promise<number> {
    const { balance } = ctx;
    const qty0 = toNumber(balance.qtyOnHand);
    const value0 = toNumber(balance.inventoryValue);
    applyDecrease(balance, qty0, value0, qty, qty * recordedUnitCost);
    return recordedUnitCost;
  },
};

function applyDecrease(
  balance: CostingContext['balance'],
  qty0: number,
  value0: number,
  qty: number,
  removedValue: number,
): void {
  const qty1 = roundTo(qty0 - qty, 3);
  const value1 = qty1 > 0 ? roundTo(value0 - removedValue, 2) : 0;
  balance.qtyOnHand = String(qty1);
  balance.inventoryValue = String(value1);
  balance.avgCost = String(
    qty1 > 0 ? roundTo(value1 / qty1, 2) : toNumber(balance.avgCost),
  );
}
