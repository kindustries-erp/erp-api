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
import type { BaseCreateStockVoucherLineDto } from '@/v2/core/inventory-movements-core/dto/base-stock-voucher-line.dto';
import { GarageLineItemResolver } from '@/v2/modules/items-garage/services/garage-line-item-resolver.service';
import type { EntityManager } from 'typeorm';
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
    private readonly itemResolver: GarageLineItemResolver,
  ) {
    super(dataSource, events, engine);
  }

  /** Phiếu xuất: chỉ chuẩn hóa mã đã có trong danh mục, không tạo mã mới (tồn thiếu vẫn bị sổ kho chặn). */
  protected prepareLines(
    manager: EntityManager,
    lines: BaseCreateStockVoucherLineDto[],
  ): Promise<BaseCreateStockVoucherLineDto[]> {
    return this.itemResolver.resolveLines(manager, lines, { create: false });
  }

  /** Phiếu xuất: mọi dòng là xuất. */
  protected resolveDirection(): StockDirection {
    return 'OUT';
  }
}
