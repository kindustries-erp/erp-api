import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ErpGoodsIssue } from './entities/erp_goods_issue.entity';
import { ErpGoodsIssueLine } from './entities/erp_goods_issue_line.entity';
import { ErpInventoryTransaction } from '../inventory-core/entities/erp_inventory_transaction.entity';
import { ErpInventoryBalance } from '../inventory-core/entities/erp_inventory_balance.entity';
import { ErpSalesOrder } from '../sales-orders-core/entities/erp_sales_order.entity';
import { ErpSalesOrderLine } from '../sales-orders-core/entities/erp_sales_order_line.entity';
import { ErpInventorySerial } from '../inventory-core/entities/erp_inventory_serial.entity';
import { ErpVehicle } from '../erp-mfg-core/entities/erp_vehicle.entity';
import { GoodsIssuesCoreController } from './goods-issues-core.controller';
import { GoodsIssuesCoreService } from './goods-issues-core.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ErpGoodsIssue,
      ErpGoodsIssueLine,
      ErpInventoryTransaction,
      ErpInventoryBalance,
      ErpSalesOrder,
      ErpSalesOrderLine,
      ErpInventorySerial,
      ErpVehicle,
    ]),
  ],
  controllers: [GoodsIssuesCoreController],
  providers: [GoodsIssuesCoreService],
  exports: [GoodsIssuesCoreService],
})
export class GoodsIssuesCoreModule {}
