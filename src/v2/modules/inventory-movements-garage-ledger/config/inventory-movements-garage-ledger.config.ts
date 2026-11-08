import type { StockLedgerConfig } from '@/v2/core/inventory-movements-core';
import { InventoryMovementsGarageBalance } from '../entities/inventory-movements-garage-balance.entity';
import { InventoryMovementsGarageCostLayer } from '../entities/inventory-movements-garage-cost-layer.entity';
import { InventoryMovementsGarageTransaction } from '../entities/inventory-movements-garage-transaction.entity';

/**
 * Cấu hình sổ tồn của Garage: bảng riêng garage_stock_*, phạm vi GARAGE, bình quân gia quyền.
 * Đổi phương pháp giá vốn sau khi đã có số dư là sai số tồn cũ, nên không đổi ở đây khi chưa có kế hoạch migrate.
 */
export const INVENTORY_MOVEMENTS_GARAGE_LEDGER: StockLedgerConfig = {
  ledgerScope: 'GARAGE',
  costingMethod: 'WEIGHTED_AVG',
  tables: {
    balance: InventoryMovementsGarageBalance,
    transaction: InventoryMovementsGarageTransaction,
    costLayer: InventoryMovementsGarageCostLayer,
  },
};
