import { Module } from '@nestjs/common';
import { CompanyProfileModule } from '../company-profile/company-profile.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ErpSalesOrder } from './entities/erp_sales_order.entity';
import { ErpSalesOrderLine } from './entities/erp_sales_order_line.entity';
import { SalesOrdersCoreController } from './sales-orders-core.controller';
import { SalesOrdersCoreService } from './sales-orders-core.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([ErpSalesOrder, ErpSalesOrderLine]),
    CompanyProfileModule,
  ],
  controllers: [SalesOrdersCoreController],
  providers: [SalesOrdersCoreService],
  exports: [SalesOrdersCoreService],
})
export class SalesOrdersCoreModule {}
