import type { EntityManager } from 'typeorm';
import type { BaseStockBalanceEntity } from '../entities/ledger/base-stock-balance.entity';
import type {
  CostingMethod,
  StockLedgerTables,
} from '../contracts/inventory-movements-core.contract';

/** Ngữ cảnh một lần cộng/trừ tồn cho một mặt hàng. Số dư đã được khóa trước khi vào strategy. */
export interface CostingContext {
  manager: EntityManager;
  balance: BaseStockBalanceEntity;
  transactionDate: Date;
  tables: StockLedgerTables;
}

/**
 * Chiến lược giá vốn. Mỗi hàm cập nhật trực tiếp `balance` (qtyOnHand, inventoryValue, avgCost)
 * và, với FIFO, bảng lớp giá. Engine chịu trách nhiệm lưu balance sau mỗi lần gọi.
 */
export interface CostingStrategy {
  readonly method: CostingMethod;
  /** Nhập `qty` với giá `unitCost`. */
  receive(ctx: CostingContext, qty: number, unitCost: number): Promise<void>;
  /** Xuất `qty`. Trả về giá vốn đơn vị áp dụng. Engine đã kiểm tồn đủ trước khi gọi. */
  issue(ctx: CostingContext, qty: number): Promise<number>;
  /**
   * Trừ `qty` khi đảo một phiếu nhập: bỏ đúng giá trị đã nhập (`recordedUnitCost`).
   * Trả về giá đơn vị đã bỏ.
   */
  withdrawReceived(
    ctx: CostingContext,
    qty: number,
    recordedUnitCost: number,
  ): Promise<number>;
}
