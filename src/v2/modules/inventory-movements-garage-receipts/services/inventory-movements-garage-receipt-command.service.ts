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
import { InventoryMovementsGarageReceipt } from '../entities/inventory-movements-garage-receipt.entity';
import { InventoryMovementsGarageReceiptLine } from '../entities/inventory-movements-garage-receipt-line.entity';

@Injectable()
export class InventoryMovementsGarageReceiptCommandService extends AbstractStockLineVoucherCommandService<
  InventoryMovementsGarageReceipt,
  InventoryMovementsGarageReceiptLine
> {
  protected readonly headerEntity = InventoryMovementsGarageReceipt;
  protected readonly lineEntity = InventoryMovementsGarageReceiptLine;
  protected readonly docType = 'GARAGE_STOCK_RECEIPT';
  protected readonly ledger = INVENTORY_MOVEMENTS_GARAGE_LEDGER;
  protected readonly transactionType: StockTransactionType = 'RECEIPT';

  constructor(
    dataSource: DataSource,
    events: ApprovalEventService,
    engine: StockMovementEngineService,
  ) {
    super(dataSource, events, engine);
  }

  /** Phiếu nhập: mọi dòng là nhập. */
  protected resolveDirection(): StockDirection {
    return 'IN';
  }
}
