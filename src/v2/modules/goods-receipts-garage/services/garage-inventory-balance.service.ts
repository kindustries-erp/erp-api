import { Injectable } from '@nestjs/common';
import { EntityManager, IsNull } from 'typeorm';
import { GarageInventoryBalance } from '../entities/garage-inventory-balance.entity';

/** Một dòng tồn cần cộng (khi post) hoặc trừ (khi hủy phiếu đã post). */
export interface BalanceMove {
  itemCode: string;
  itemName: string;
  unit: string;
  qty: number;
  cost: number;
}

/**
 * Cập nhật tồn garage có khóa. Mỗi mặt hàng được khóa bằng pessimistic_write trước khi đọc,
 * nên hai phiếu cùng mặt hàng không mất cập nhật. Dòng tồn mới tạo bằng INSERT ... ON CONFLICT
 * DO NOTHING theo unique index (partial, tách chi nhánh null), nên hai request đồng thời không sinh trùng.
 * Duyệt theo itemCode tăng dần để mọi giao dịch khóa cùng thứ tự, tránh deadlock.
 */
@Injectable()
export class GarageInventoryBalanceService {
  /** Cộng tồn khi post phiếu nhập. */
  async apply(
    manager: EntityManager,
    branchId: string | null | undefined,
    moves: BalanceMove[],
  ): Promise<void> {
    for (const move of sortByItemCode(moves)) {
      await this.ensureRow(manager, branchId, move);
      const balance = await this.lockRow(manager, branchId, move.itemCode);
      if (!balance)
        throw new Error(`Thiếu dòng tồn sau khi tạo: ${move.itemCode}`);
      balance.qtyOnHand = String(Number(balance.qtyOnHand || 0) + move.qty);
      balance.avgCost = String(move.cost > 0 ? move.cost : balance.avgCost);
      await manager.save(GarageInventoryBalance, balance);
    }
  }

  /** Trừ tồn khi hủy phiếu đã post. Dòng không tồn tại thì bỏ qua, không tạo mới. */
  async revert(
    manager: EntityManager,
    branchId: string | null | undefined,
    moves: BalanceMove[],
  ): Promise<void> {
    for (const move of sortByItemCode(moves)) {
      const balance = await this.lockRow(manager, branchId, move.itemCode);
      if (!balance) continue;
      const next = Number(balance.qtyOnHand || 0) - move.qty;
      balance.qtyOnHand = String(Math.max(0, next));
      await manager.save(GarageInventoryBalance, balance);
    }
  }

  private async ensureRow(
    manager: EntityManager,
    branchId: string | null | undefined,
    move: BalanceMove,
  ): Promise<void> {
    const conflict = branchId
      ? '("branch_id", "item_code") WHERE "branch_id" IS NOT NULL'
      : '("item_code") WHERE "branch_id" IS NULL';
    await manager.query(
      `INSERT INTO "inventory_balances_garage"
         ("id", "branch_id", "item_code", "item_name", "unit", "qty_on_hand", "avg_cost", "created_at", "updated_at")
       VALUES (uuid_generate_v4(), $1, $2, $3, $4, 0, 0, now(), now())
       ON CONFLICT ${conflict} DO NOTHING`,
      [branchId ?? null, move.itemCode, move.itemName, move.unit || 'Cái'],
    );
  }

  private lockRow(
    manager: EntityManager,
    branchId: string | null | undefined,
    itemCode: string,
  ): Promise<GarageInventoryBalance | null> {
    return manager.findOne(GarageInventoryBalance, {
      where: { branchId: branchId ? branchId : IsNull(), itemCode },
      lock: { mode: 'pessimistic_write' },
    });
  }
}

function sortByItemCode(moves: BalanceMove[]): BalanceMove[] {
  return [...moves].sort((a, b) =>
    a.itemCode < b.itemCode ? -1 : a.itemCode > b.itemCode ? 1 : 0,
  );
}
