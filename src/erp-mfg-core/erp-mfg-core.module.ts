import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ErpInventoryItem } from '../inventory-core/entities/erp_inventory_item.entity';
import { ErpInventoryBalance } from '../inventory-core/entities/erp_inventory_balance.entity';
import { ErpPurchaseOrder } from '../purchase-orders-core/entities/erp_purchase_order.entity';
import { ErpVehicle } from './entities/erp_vehicle.entity';
import { ErpMfgCoreController } from './erp-mfg-core.controller';
import { ErpMfgCoreService } from './erp-mfg-core.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ErpInventoryItem,
      ErpInventoryBalance,
      ErpPurchaseOrder,
      ErpVehicle,
    ]),
  ],
  controllers: [ErpMfgCoreController],
  providers: [ErpMfgCoreService],
})
export class ErpMfgCoreModule {}
