import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ErpInventoryItem } from './entities/erp_inventory_item.entity';
import { InventoryItemsController } from './inventory-core.controller';
import { InventoryItemsService } from './inventory-core.service';

@Module({
  imports: [TypeOrmModule.forFeature([ErpInventoryItem])],
  controllers: [InventoryItemsController],
  providers: [InventoryItemsService],
  exports: [InventoryItemsService],
})
export class InventoryCoreModule {}
