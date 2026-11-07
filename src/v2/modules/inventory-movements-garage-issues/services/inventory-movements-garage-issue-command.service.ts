import { INVENTORY_MOVEMENTS_GARAGE_LEDGER } from '@/v2/modules/inventory-movements-garage-ledger/config/inventory-movements-garage-ledger.config';
import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ApprovalEventService } from '@/v2/core/approval-core/approval-event.service';
import {
  StockDirection,
  StockMovementEngineService,
  StockTransactionType,
} from '@/v2/core/inventory-movements-core';
import { AbstractStockLineVoucherCommandService } from '@/v2/core/inventory-movements-core';
import { InventoryMovementsGarageIssue } from '../entities/inventory-movements-garage-issue.entity';
import { InventoryMovementsGarageIssueLine } from '../entities/inventory-movements-garage-issue-line.entity';

@Injectable()
export class InventoryMovementsGarageIssueCommandService extends AbstractStockLineVoucherCommandService<
  InventoryMovementsGarageIssue,
  InventoryMovementsGarageIssueLine
> {
  protected readonly headerEntity = InventoryMovementsGarageIssue;
  protected readonly lineEntity = InventoryMovementsGarageIssueLine;
  protected readonly docType = 'GARAGE_STOCK_ISSUE';
  protected readonly ledger = INVENTORY_MOVEMENTS_GARAGE_LEDGER;
  protected readonly transactionType: StockTransactionType = 'ISSUE';

  constructor(
    dataSource: DataSource,
    events: ApprovalEventService,
    engine: StockMovementEngineService,
  ) {
    super(dataSource, events, engine);
  }

  /** Phiếu xuất: mọi dòng là xuất. */
  protected resolveDirection(): StockDirection {
    return 'OUT';
  }
}
