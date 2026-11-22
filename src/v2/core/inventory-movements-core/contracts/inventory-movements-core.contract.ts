import type { EntityTarget } from 'typeorm';
import type { TransitionRule } from '@/v2/core/approval-core/approval.engine';
import type { BaseStockBalanceEntity } from '../entities/ledger/base-stock-balance.entity';
import type { BaseStockCostLayerEntity } from '../entities/ledger/base-stock-cost-layer.entity';
import type { BaseStockTransactionEntity } from '../entities/ledger/base-stock-transaction.entity';

/** Hợp đồng lõi họ inventory-movements-core: các trường mà mọi module con phải có. */
export interface BaseStockVoucherContract {
  id: string;
  isDeleted: boolean;
  status: string;
}

/** Hành động vòng đời của chứng từ kho: ghi sổ (cộng/trừ tồn) hoặc hủy (đảo lại tồn đã ghi). */
export type StockVoucherAction = 'post' | 'cancel';

export const STOCK_VOUCHER_TRANSITIONS: Record<
  StockVoucherAction,
  TransitionRule
> = {
  post: { from: ['DRAFT'], to: 'POSTED' },
  cancel: { from: ['POSTED'], to: 'CANCELLED' },
};

/** Chiều di chuyển của một dòng: IN làm tăng tồn, OUT làm giảm tồn. */
export type StockDirection = 'IN' | 'OUT';

/**
 * Phương pháp tính giá vốn khi xuất. Khai báo ở cấu hình của từng ledger (module),
 * không đổi theo từng request: đổi phương pháp giữa chừng làm sai số tồn cũ.
 */
export type CostingMethod = 'WEIGHTED_AVG' | 'FIFO';

/** Loại chứng từ kho ghi vào sổ giao dịch. Bút toán đảo thêm hậu tố _CANCEL do core tự ghi. */
export type StockTransactionType = 'RECEIPT' | 'ISSUE' | 'ADJUSTMENT';

/** Một dòng di chuyển kho đã chuẩn hóa, do module chuyển từ dòng chứng từ của nó. */
export interface StockMoveLine {
  itemCode: string;
  itemName: string;
  unit: string;
  qty: number;
  direction: StockDirection;
  transactionType: StockTransactionType;
  /** IN: giá nhập. OUT: bỏ trống, core tính giá xuất theo costingMethod. */
  unitCost?: number | null;
}

/** Bảng của một ledger do module sở hữu. Lõi chỉ đọc/ghi qua các entity này, không biết tên bảng. */
export interface StockLedgerTables {
  balance: EntityTarget<BaseStockBalanceEntity>;
  transaction: EntityTarget<BaseStockTransactionEntity>;
  costLayer: EntityTarget<BaseStockCostLayerEntity>;
}

/** Cấu hình một ledger tồn kho: phạm vi tách số liệu, phương pháp giá vốn và bảng của ledger. */
export interface StockLedgerConfig {
  /** Mã phạm vi, ví dụ GARAGE. Tồn của các phạm vi khác nhau không lẫn vào nhau. */
  ledgerScope: string;
  costingMethod: CostingMethod;
  tables: StockLedgerTables;
}
