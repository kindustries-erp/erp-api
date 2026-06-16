import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ErpGoodsReceipt } from './entities/erp_goods_receipt.entity';
import { ErpGoodsReceiptLine } from './entities/erp_goods_receipt_line.entity';
import { ErpInventoryTransaction } from '../inventory-core/entities/erp_inventory_transaction.entity';
import { ErpInventoryBalance } from '../inventory-core/entities/erp_inventory_balance.entity';
import { ErpPurchaseOrder } from '../purchase-orders-core/entities/erp_purchase_order.entity';
import { ErpPurchaseOrderLine } from '../purchase-orders-core/entities/erp_purchase_order_line.entity';
import { GoodsReceiptsCoreController } from './goods-receipts-core.controller';
import { GoodsReceiptsCoreService } from './goods-receipts-core.service';
import { JournalEntriesModule } from '../journal-entries/journal-entries.module';
import { AccountingConfigsCoreModule } from '../accounting-configs-core/accounting-configs-core.module';
import { DocumentDependenciesCoreModule } from '../document-dependencies-core/document-dependencies-core.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ErpGoodsReceipt,
      ErpGoodsReceiptLine,
      ErpInventoryTransaction,
      ErpInventoryBalance,
      ErpPurchaseOrder,
      ErpPurchaseOrderLine,
    ]),
    JournalEntriesModule,
    AccountingConfigsCoreModule,
    DocumentDependenciesCoreModule,
  ],
  controllers: [GoodsReceiptsCoreController],
  providers: [GoodsReceiptsCoreService],
  exports: [GoodsReceiptsCoreService],
})
export class GoodsReceiptsCoreModule {}
