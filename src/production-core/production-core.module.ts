import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ErpBom } from '../bom-core/entities/erp_bom.entity';
import { ErpBomLine } from '../bom-core/entities/erp_bom_line.entity';
import { ErpInventoryBalance } from '../inventory-core/entities/erp_inventory_balance.entity';
import { ErpInventoryTransaction } from '../inventory-core/entities/erp_inventory_transaction.entity';
import { ErpProductionOrder } from './entities/erp_production_order.entity';
import { ErpProductionOrderMaterial } from './entities/erp_production_order_material.entity';
import { ErpGoodsIssue } from '../goods-issues-core/entities/erp_goods_issue.entity';
import { ErpGoodsIssueLine } from '../goods-issues-core/entities/erp_goods_issue_line.entity';
import { ErpGoodsReceipt } from '../goods-receipts-core/entities/erp_goods_receipt.entity';
import { ErpGoodsReceiptLine } from '../goods-receipts-core/entities/erp_goods_receipt_line.entity';
import { ProductionCoreController } from './production-core.controller';
import { ProductionCoreService } from './production-core.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ErpBom,
      ErpBomLine,
      ErpInventoryBalance,
      ErpInventoryTransaction,
      ErpProductionOrder,
      ErpProductionOrderMaterial,
      ErpGoodsIssue,
      ErpGoodsIssueLine,
      ErpGoodsReceipt,
      ErpGoodsReceiptLine,
    ]),
  ],
  controllers: [ProductionCoreController],
  providers: [ProductionCoreService],
  exports: [ProductionCoreService],
})
export class ProductionCoreModule {}
