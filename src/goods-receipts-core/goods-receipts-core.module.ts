import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ErpGoodsReceipt } from './entities/erp_goods_receipt.entity';
import { ErpGoodsReceiptLine } from './entities/erp_goods_receipt_line.entity';
import { ErpInventoryTransaction } from '../inventory-core/entities/erp_inventory_transaction.entity';
import { ErpInventoryBalance } from '../inventory-core/entities/erp_inventory_balance.entity';
import { ErpPurchaseOrder } from '../purchase-orders-core/entities/erp_purchase_order.entity';
import { ErpPurchaseOrderLine } from '../purchase-orders-core/entities/erp_purchase_order_line.entity';
import { ErpInventoryItem } from '../inventory-core/entities/erp_inventory_item.entity';
import { ErpInventoryTrackingSerial } from '../inventory-core/entities/erp_inventory_tracking_serial.entity';
import { GoodsReceiptsCoreController } from './goods-receipts-core.controller';
import { GoodsReceiptsCoreService } from './goods-receipts-core.service';
import { GoodsReceiptsCronService } from './goods-receipts-cron.service';
import { DocumentDependenciesCoreModule } from '../document-dependencies-core/document-dependencies-core.module';
import { CompanyProfileModule } from '../company-profile/company-profile.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ErpGoodsReceipt,
      ErpGoodsReceiptLine,
      ErpInventoryTransaction,
      ErpInventoryBalance,
      ErpPurchaseOrder,
      ErpPurchaseOrderLine,
      ErpInventoryItem,
      ErpInventoryTrackingSerial,
    ]),
    DocumentDependenciesCoreModule,
    CompanyProfileModule,
  ],
  controllers: [GoodsReceiptsCoreController],
  providers: [GoodsReceiptsCoreService, GoodsReceiptsCronService],
  exports: [GoodsReceiptsCoreService, GoodsReceiptsCronService],
})
export class GoodsReceiptsCoreModule {}
