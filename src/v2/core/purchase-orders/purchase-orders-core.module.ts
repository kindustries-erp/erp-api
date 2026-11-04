import { Module } from '@nestjs/common';
import { PurchaseOrderEngine } from './services/purchase-order-engine.service';
import { PurchaseOrderNumberingService } from './services/purchase-order-numbering.service';

/**
 * Module lõi PO v2. Không có controller và không có entity: module con
 * (purchase-orders, garage-purchase-orders) khai báo bảng và service kế thừa
 * AbstractPurchaseOrderCommandService / AbstractPurchaseOrderQueryService.
 * Lõi KHÔNG import module của goods-receipts (tránh ghép cứng hai lõi).
 */
@Module({
  providers: [PurchaseOrderEngine, PurchaseOrderNumberingService],
  exports: [PurchaseOrderEngine, PurchaseOrderNumberingService],
})
export class PurchaseOrdersCoreModule {}
