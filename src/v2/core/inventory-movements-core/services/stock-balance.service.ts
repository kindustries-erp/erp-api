import { Injectable } from '@nestjs/common';
import { EntityManager, IsNull } from 'typeorm';
import type { StockLedgerTables } from '../contracts/inventory-movements-core.contract';
import type { BaseStockBalanceEntity } from '../entities/ledger/base-stock-balance.entity';

/** Khóa định danh một dòng số dư: phạm vi ledger, chi nhánh (null = không chi nhánh), mã hàng. */
export interface StockLedgerKey {
  ledgerScope: string;
  branchId: string | null;
  itemCode: string;
}

/**
 * Quản lý dòng số dư có khóa. Dòng mới được tạo bằng INSERT ... ON CONFLICT DO NOTHING theo đúng
 * unique index partial của bảng do module khai báo, nên hai giao dịch đồng thời không sinh trùng dòng.
 * Sau đó khóa pessimistic_write trước khi đọc số dư để cộng/trừ.
 */
@Injectable()
export class StockBalanceService {
  async ensureRow(
    manager: EntityManager,
    tables: StockLedgerTables,
    key: StockLedgerKey,
    itemName: string,
    unit: string,
  ): Promise<void> {
    const table = manager.connection.getMetadata(tables.balance).tableName;
    const conflict = key.branchId
      ? '("ledger_scope", "branch_id", "item_code") WHERE "branch_id" IS NOT NULL'
      : '("ledger_scope", "item_code") WHERE "branch_id" IS NULL';
    await manager.query(
      `INSERT INTO "${table}"
         ("id", "ledger_scope", "branch_id", "item_code", "item_name", "unit",
          "qty_on_hand", "inventory_value", "avg_cost", "created_at", "updated_at")
       VALUES (uuid_generate_v4(), $1, $2, $3, $4, $5, 0, 0, 0, now(), now())
       ON CONFLICT ${conflict} DO NOTHING`,
      [
        key.ledgerScope,
        key.branchId ?? null,
        key.itemCode,
        itemName,
        unit || 'Cái',
      ],
    );
  }

  /** Khóa và đọc số dư. Phải gọi sau ensureRow trong cùng transaction. */
  async lockRow(
    manager: EntityManager,
    tables: StockLedgerTables,
    key: StockLedgerKey,
  ): Promise<BaseStockBalanceEntity> {
    const balance = await manager.findOne(tables.balance, {
      where: {
        ledgerScope: key.ledgerScope,
        branchId: key.branchId ? key.branchId : IsNull(),
        itemCode: key.itemCode,
      } as never,
      lock: { mode: 'pessimistic_write' },
    });
    if (!balance) {
      throw new Error(`Thiếu dòng số dư sau khi tạo: ${key.itemCode}`);
    }
    return balance as BaseStockBalanceEntity;
  }
}
