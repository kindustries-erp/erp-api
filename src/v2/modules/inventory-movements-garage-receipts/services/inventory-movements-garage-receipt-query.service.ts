import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { BaseVoucherEngineService } from '@/v2/core/goods-receipts-core/services/base-voucher-engine.service';
import { AbstractStockLineVoucherQueryService } from '@/v2/core/inventory-movements-core';
import { InventoryMovementsGarageReceipt } from '../entities/inventory-movements-garage-receipt.entity';
import { InventoryMovementsGarageReceiptLine } from '../entities/inventory-movements-garage-receipt-line.entity';

@Injectable()
export class InventoryMovementsGarageReceiptQueryService extends AbstractStockLineVoucherQueryService<
  InventoryMovementsGarageReceipt,
  InventoryMovementsGarageReceiptLine
> {
  protected readonly headerEntity = InventoryMovementsGarageReceipt;
  protected readonly lineEntity = InventoryMovementsGarageReceiptLine;
  protected readonly voucherPrefix = 'GSR';

  constructor(dataSource: DataSource, voucherEngine: BaseVoucherEngineService) {
    super(dataSource, voucherEngine);
  }
}
