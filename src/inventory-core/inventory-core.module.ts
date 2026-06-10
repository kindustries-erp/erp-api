import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ErpInventoryItem } from './entities/erp_inventory_item.entity';
import { ErpInventoryTransaction } from './entities/erp_inventory_transaction.entity';
import { ErpInventoryBalance } from './entities/erp_inventory_balance.entity';
import { InventoryItemsController } from './inventory-core.controller';
import { InventoryItemsService } from './inventory-core.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ErpInventoryItem,
      ErpInventoryTransaction,
      ErpInventoryBalance,
    ]),
  ],
  controllers: [InventoryItemsController],
  providers: [InventoryItemsService],
  exports: [InventoryItemsService],
})
export class InventoryCoreModule {}
