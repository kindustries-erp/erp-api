import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GaragePurchaseOrder } from './entities/garage-purchase-order.entity';
import { GaragePurchaseOrderLine } from './entities/garage-purchase-order-line.entity';
import { PurchaseOrdersCoreModule } from '@/v2/core/purchase-orders/purchase-orders-core.module';
import { GaragePurchaseOrderController } from './controllers/garage-purchase-order.controller';
import { GaragePurchaseOrdersService } from './garage-purchase-orders.service';
import { GaragePurchaseOrderCommandService } from './services/garage-purchase-order-command.service';
import { GaragePurchaseOrderQueryService } from './services/garage-purchase-order-query.service';

/**
 * Module PO garage v2 (bảng erp_garage_purchase_orders, mới).
 * Lõi nghiệp vụ lấy từ PurchaseOrdersCoreModule, không import module PO core.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([GaragePurchaseOrder, GaragePurchaseOrderLine]),
    PurchaseOrdersCoreModule,
  ],
  controllers: [GaragePurchaseOrderController],
  providers: [
    GaragePurchaseOrderCommandService,
    GaragePurchaseOrderQueryService,
    GaragePurchaseOrdersService,
  ],
  exports: [GaragePurchaseOrdersService],
})
export class GaragePurchaseOrdersModule {}
