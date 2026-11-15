import { InventoryMovementsGarageLedgerModule } from '@/v2/modules/inventory-movements-garage-ledger/inventory-movements-garage-ledger.module';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RbacCoreModule } from '@/v2/core/rbac-core';
import { ApprovalEvent } from '@/v2/core/approval-core/entities/approval-event.entity';
import { ApprovalEventService } from '@/v2/core/approval-core/approval-event.service';
import { InventoryMovementsCoreModule } from '@/v2/core/inventory-movements-core';
import { GoodsReceiptsCoreModule } from '@/v2/core/goods-receipts-core';
import { InventoryMovementsGarageAdjustment } from './entities/inventory-movements-garage-adjustment.entity';
import { InventoryMovementsGarageAdjustmentLine } from './entities/inventory-movements-garage-adjustment-line.entity';
import { InventoryMovementsGarageAdjustmentController } from './controllers/inventory-movements-garage-adjustment.controller';
import { InventoryMovementsGarageAdjustmentCommandService } from './services/inventory-movements-garage-adjustment-command.service';
import { InventoryMovementsGarageAdjustmentQueryService } from './services/inventory-movements-garage-adjustment-query.service';
import { InventoryMovementsGarageAdjustmentsService } from './inventory-movements-garage-adjustments.service';
import { ItemsGarageModule } from '@/v2/modules/items-garage/items-garage.module';

/** Module điều chỉnh kho Garage: ghép lõi inventory-movements-core (sổ tồn) và goods-receipts-core (đánh số phiếu). */
@Module({
  imports: [
    InventoryMovementsGarageLedgerModule,
    TypeOrmModule.forFeature([
      InventoryMovementsGarageAdjustment,
      InventoryMovementsGarageAdjustmentLine,
      ApprovalEvent,
    ]),
    RbacCoreModule,
    InventoryMovementsCoreModule,
    ItemsGarageModule,
    GoodsReceiptsCoreModule,
  ],
  controllers: [InventoryMovementsGarageAdjustmentController],
  providers: [
    ApprovalEventService,
    InventoryMovementsGarageAdjustmentCommandService,
    InventoryMovementsGarageAdjustmentQueryService,
    InventoryMovementsGarageAdjustmentsService,
  ],
  exports: [InventoryMovementsGarageAdjustmentsService],
})
export class InventoryMovementsGarageAdjustmentsModule {}
