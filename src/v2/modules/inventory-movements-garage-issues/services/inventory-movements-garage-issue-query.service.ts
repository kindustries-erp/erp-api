import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { BaseVoucherEngineService } from '@/v2/core/goods-receipts-core/services/base-voucher-engine.service';
import { AbstractStockLineVoucherQueryService } from '@/v2/core/inventory-movements-core';
import { InventoryMovementsGarageIssue } from '../entities/inventory-movements-garage-issue.entity';
import { InventoryMovementsGarageIssueLine } from '../entities/inventory-movements-garage-issue-line.entity';

@Injectable()
export class InventoryMovementsGarageIssueQueryService extends AbstractStockLineVoucherQueryService<
  InventoryMovementsGarageIssue,
  InventoryMovementsGarageIssueLine
> {
  protected readonly headerEntity = InventoryMovementsGarageIssue;
  protected readonly lineEntity = InventoryMovementsGarageIssueLine;
  protected readonly voucherPrefix = 'GSI';

  constructor(dataSource: DataSource, voucherEngine: BaseVoucherEngineService) {
    super(dataSource, voucherEngine);
  }
}
