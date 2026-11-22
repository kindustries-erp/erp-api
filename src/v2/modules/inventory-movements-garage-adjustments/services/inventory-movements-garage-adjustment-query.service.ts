import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { BaseVoucherEngineService } from '@/v2/core/goods-receipts-core/services/base-voucher-engine.service';
import { AbstractStockLineVoucherQueryService } from '@/v2/core/inventory-movements-core';
import { InventoryMovementsGarageAdjustment } from '../entities/inventory-movements-garage-adjustment.entity';
import { InventoryMovementsGarageAdjustmentLine } from '../entities/inventory-movements-garage-adjustment-line.entity';

@Injectable()
export class InventoryMovementsGarageAdjustmentQueryService extends AbstractStockLineVoucherQueryService<
  InventoryMovementsGarageAdjustment,
  InventoryMovementsGarageAdjustmentLine
> {
  protected readonly headerEntity = InventoryMovementsGarageAdjustment;
  protected readonly lineEntity = InventoryMovementsGarageAdjustmentLine;
  protected readonly voucherPrefix = 'GSA';

  constructor(dataSource: DataSource, voucherEngine: BaseVoucherEngineService) {
    super(dataSource, voucherEngine);
  }
}
