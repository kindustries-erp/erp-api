import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ErpInventoryItem } from './entities/erp_inventory_item.entity';
import { ErpInventoryTransaction } from './entities/erp_inventory_transaction.entity';
import { ErpInventoryBalance } from './entities/erp_inventory_balance.entity';
import { InventoryItemsController } from './inventory-core.controller';
import { InventoryItemsService } from './inventory-core.service';
import { ErpUom } from './entities/erp_uom.entity';
import { ErpItemType } from './entities/erp_item_type.entity';
import { ErpTrackingCategory } from './entities/erp_tracking_category.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ErpInventoryItem,
      ErpInventoryTransaction,
      ErpInventoryBalance,
      ErpUom,
      ErpItemType,
      ErpTrackingCategory,
    ]),
  ],
  controllers: [InventoryItemsController],
  providers: [InventoryItemsService],
  exports: [InventoryItemsService],
})
export class InventoryCoreModule {}
