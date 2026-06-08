import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ErpInventoryBalance } from '../inventory-core/entities/erp_inventory_balance.entity';
import { ErpInventoryItem } from '../inventory-core/entities/erp_inventory_item.entity';
import { InventoryStockCoreController } from './inventory-stock-core.controller';
import { InventoryStockCoreService } from './inventory-stock-core.service';

@Module({
  imports: [TypeOrmModule.forFeature([ErpInventoryBalance, ErpInventoryItem])],
  controllers: [InventoryStockCoreController],
  providers: [InventoryStockCoreService],
})
export class InventoryStockCoreModule {}
