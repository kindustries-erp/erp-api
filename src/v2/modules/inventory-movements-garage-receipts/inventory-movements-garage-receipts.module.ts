import { InventoryMovementsGarageLedgerModule } from '@/v2/modules/inventory-movements-garage-ledger/inventory-movements-garage-ledger.module';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RbacCoreModule } from '@/v2/core/rbac-core';
import { ApprovalEvent } from '@/v2/core/approval-core/entities/approval-event.entity';
import { ApprovalEventService } from '@/v2/core/approval-core/approval-event.service';
import { InventoryMovementsCoreModule } from '@/v2/core/inventory-movements-core';
import { GoodsReceiptsCoreModule } from '@/v2/core/goods-receipts-core';
import { InventoryMovementsGarageReceipt } from './entities/inventory-movements-garage-receipt.entity';
import { InventoryMovementsGarageReceiptLine } from './entities/inventory-movements-garage-receipt-line.entity';
import { InventoryMovementsGarageReceiptController } from './controllers/inventory-movements-garage-receipt.controller';
import { InventoryMovementsGarageReceiptCommandService } from './services/inventory-movements-garage-receipt-command.service';
import { InventoryMovementsGarageReceiptQueryService } from './services/inventory-movements-garage-receipt-query.service';
import { InventoryMovementsGarageReceiptsService } from './inventory-movements-garage-receipts.service';

/** Module nhập kho Garage: ghép lõi inventory-movements-core (sổ tồn) và goods-receipts-core (đánh số phiếu). */
@Module({
  imports: [
    InventoryMovementsGarageLedgerModule,
    TypeOrmModule.forFeature([
      InventoryMovementsGarageReceipt,
      InventoryMovementsGarageReceiptLine,
      ApprovalEvent,
    ]),
    RbacCoreModule,
    InventoryMovementsCoreModule,
    GoodsReceiptsCoreModule,
  ],
  controllers: [InventoryMovementsGarageReceiptController],
  providers: [
    ApprovalEventService,
    InventoryMovementsGarageReceiptCommandService,
    InventoryMovementsGarageReceiptQueryService,
    InventoryMovementsGarageReceiptsService,
  ],
  exports: [InventoryMovementsGarageReceiptsService],
})
export class InventoryMovementsGarageReceiptsModule {}
