import { InventoryMovementsGarageLedgerModule } from '@/v2/modules/inventory-movements-garage-ledger/inventory-movements-garage-ledger.module';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RbacCoreModule } from '@/v2/core/rbac-core';
import { ApprovalEvent } from '@/v2/core/approval-core/entities/approval-event.entity';
import { ApprovalEventService } from '@/v2/core/approval-core/approval-event.service';
import { InventoryMovementsCoreModule } from '@/v2/core/inventory-movements-core';
import { GoodsReceiptsCoreModule } from '@/v2/core/goods-receipts-core';
import { InventoryMovementsGarageIssue } from './entities/inventory-movements-garage-issue.entity';
import { InventoryMovementsGarageIssueLine } from './entities/inventory-movements-garage-issue-line.entity';
import { InventoryMovementsGarageIssueController } from './controllers/inventory-movements-garage-issue.controller';
import { InventoryMovementsGarageIssueCommandService } from './services/inventory-movements-garage-issue-command.service';
import { InventoryMovementsGarageIssueQueryService } from './services/inventory-movements-garage-issue-query.service';
import { InventoryMovementsGarageIssuesService } from './inventory-movements-garage-issues.service';

/** Module xuất kho Garage: ghép lõi inventory-movements-core (sổ tồn) và goods-receipts-core (đánh số phiếu). */
@Module({
  imports: [
    InventoryMovementsGarageLedgerModule,
    TypeOrmModule.forFeature([
      InventoryMovementsGarageIssue,
      InventoryMovementsGarageIssueLine,
      ApprovalEvent,
    ]),
    RbacCoreModule,
    InventoryMovementsCoreModule,
    GoodsReceiptsCoreModule,
  ],
  controllers: [InventoryMovementsGarageIssueController],
  providers: [
    ApprovalEventService,
    InventoryMovementsGarageIssueCommandService,
    InventoryMovementsGarageIssueQueryService,
    InventoryMovementsGarageIssuesService,
  ],
  exports: [InventoryMovementsGarageIssuesService],
})
export class InventoryMovementsGarageIssuesModule {}
