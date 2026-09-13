import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ErpPurchaseOrder } from './entities/erp_purchase_order.entity';
import { ErpPurchaseOrderLine } from './entities/erp_purchase_order_line.entity';
import { PurchaseOrdersCoreController } from './purchase-orders-core.controller';
import { PurchaseOrdersCoreService } from './purchase-orders-core.service';
import { CompanyProfileModule } from '../company-profile/company-profile.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ErpPurchaseOrder, ErpPurchaseOrderLine]),
    CompanyProfileModule,
  ],
  controllers: [PurchaseOrdersCoreController],
  providers: [PurchaseOrdersCoreService],
  exports: [PurchaseOrdersCoreService],
})
export class PurchaseOrdersCoreModule {}
