import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ErpInventoryItem } from '../inventory-core/entities/erp_inventory_item.entity';
import { ErpInventoryBalance } from '../inventory-core/entities/erp_inventory_balance.entity';
import { ErpInventoryTransaction } from '../inventory-core/entities/erp_inventory_transaction.entity';
import { ErpInventoryTrackingLot } from '../inventory-core/entities/erp_inventory_tracking_lot.entity';
import { ErpInventoryTrackingSerial } from '../inventory-core/entities/erp_inventory_tracking_serial.entity';
import { ErpPurchaseOrder } from '../purchase-orders-core/entities/erp_purchase_order.entity';
import { ErpPurchaseOrderLine } from '../purchase-orders-core/entities/erp_purchase_order_line.entity';
import { ErpVehicle } from './entities/erp_vehicle.entity';
import { ErpUom } from '../inventory-core/entities/erp_uom.entity';
import { ErpItemType } from '../inventory-core/entities/erp_item_type.entity';
import { ErpMfgCoreController } from './erp-mfg-core.controller';
import { ErpMfgCoreService } from './erp-mfg-core.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ErpInventoryItem,
      ErpInventoryBalance,
      ErpInventoryTransaction,
      ErpInventoryTrackingLot,
      ErpInventoryTrackingSerial,
      ErpPurchaseOrder,
      ErpPurchaseOrderLine,
      ErpVehicle,
      ErpUom,
      ErpItemType,
    ]),
  ],
  controllers: [ErpMfgCoreController],
  providers: [ErpMfgCoreService],
})
export class ErpMfgCoreModule {}
