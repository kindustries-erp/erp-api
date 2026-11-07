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
import { InventoryMovementsGarageAdjustment } from '../entities/inventory-movements-garage-adjustment.entity';
import { InventoryMovementsGarageAdjustmentLine } from '../entities/inventory-movements-garage-adjustment-line.entity';
import { CreateInventoryMovementsGarageAdjustmentLineDto } from '../dto/create-inventory-movements-garage-adjustment.dto';

@Injectable()
export class InventoryMovementsGarageAdjustmentCommandService extends AbstractStockLineVoucherCommandService<
  InventoryMovementsGarageAdjustment,
  InventoryMovementsGarageAdjustmentLine
> {
  protected readonly headerEntity = InventoryMovementsGarageAdjustment;
  protected readonly lineEntity = InventoryMovementsGarageAdjustmentLine;
  protected readonly docType = 'GARAGE_STOCK_ADJUSTMENT';
  protected readonly ledger = INVENTORY_MOVEMENTS_GARAGE_LEDGER;
  protected readonly transactionType: StockTransactionType = 'ADJUSTMENT';

  constructor(
    dataSource: DataSource,
    events: ApprovalEventService,
    engine: StockMovementEngineService,
  ) {
    super(dataSource, events, engine);
  }

  /** Phiếu điều chỉnh: chiều của mỗi dòng do người lập chọn (IN tăng, OUT giảm). */
  protected resolveDirection(
    dto: CreateInventoryMovementsGarageAdjustmentLineDto,
  ): StockDirection {
    return dto.direction;
  }
}
