import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ErpSalesOrder } from '../sales-orders-core/entities/erp_sales_order.entity';
import { SalesServiceOrdersCoreController } from './sales-service-orders-core.controller';
import { SalesServiceOrdersCoreService } from './sales-service-orders-core.service';

@Module({
  imports: [TypeOrmModule.forFeature([ErpSalesOrder])],
  controllers: [SalesServiceOrdersCoreController],
  providers: [SalesServiceOrdersCoreService],
})
export class SalesServiceOrdersCoreModule {}
