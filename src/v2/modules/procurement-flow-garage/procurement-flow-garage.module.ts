import { Module } from '@nestjs/common';
import { GoodsReceiptsCoreModule } from '@/v2/core/goods-receipts-core/goods-receipts-core.module';
import { InventoryMovementsCoreModule } from '@/v2/core/inventory-movements-core/inventory-movements-core.module';
import { InventoryMovementsGarageLedgerModule } from '@/v2/modules/inventory-movements-garage-ledger/inventory-movements-garage-ledger.module';
import { NotificationsInboxModule } from '@/v2/modules/notifications-inbox/notifications-inbox.module';
import { GarageProcurementOrdersModule } from '@/v2/modules/procurement-orders-garage/procurement-orders-garage.module';
import { GarageProcurementFlowService } from './services/garage-procurement-flow.service';
import { GarageProcurementFlowEventsService } from './services/garage-procurement-flow-events.service';
import { GarageProcurementFlowStockAdapter } from './services/garage-procurement-flow-stock.adapter';
import { ItemsGarageModule } from '@/v2/modules/items-garage/items-garage.module';

@Module({
  imports: [
    GarageProcurementOrdersModule,
    InventoryMovementsCoreModule,
    InventoryMovementsGarageLedgerModule,
    GoodsReceiptsCoreModule,
    NotificationsInboxModule,
    ItemsGarageModule,
  ],
  providers: [
    GarageProcurementFlowService,
    GarageProcurementFlowEventsService,
    GarageProcurementFlowStockAdapter,
  ],
  exports: [GarageProcurementFlowService],
})
export class GarageProcurementFlowModule {}
