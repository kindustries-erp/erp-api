import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InventoryAdjustmentsCoreService } from './inventory-adjustments-core.service';
import { InventoryAdjustmentsCoreController } from './inventory-adjustments-core.controller';
import { ErpInventoryAdjustment } from './entities/erp_inventory_adjustment.entity';
import { ErpInventoryAdjustmentLine } from './entities/erp_inventory_adjustment_line.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ErpInventoryAdjustment,
      ErpInventoryAdjustmentLine,
    ]),
  ],
  controllers: [InventoryAdjustmentsCoreController],
  providers: [InventoryAdjustmentsCoreService],
  exports: [InventoryAdjustmentsCoreService],
})
export class InventoryAdjustmentsCoreModule {}
