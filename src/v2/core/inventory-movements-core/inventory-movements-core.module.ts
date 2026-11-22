import { Module } from '@nestjs/common';
import { StockBalanceService } from './services/stock-balance.service';
import { StockMovementEngineService } from './services/stock-movement-engine.service';

/**
 * Module lõi họ inventory-movements-core: engine cộng/trừ tồn và dịch vụ số dư.
 * Không khai báo entity: bảng do module sở hữu, truyền vào qua StockLedgerConfig.tables.
 * Không có controller.
 */
@Module({
  providers: [StockBalanceService, StockMovementEngineService],
  exports: [StockBalanceService, StockMovementEngineService],
})
export class InventoryMovementsCoreModule {}
