import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ErpPurchaseRequest } from './entities/erp_purchase_request.entity';
import { PurchaseRequestsCoreController } from './purchase-requests-core.controller';
import { PurchaseRequestsCoreService } from './purchase-requests-core.service';

@Module({
  imports: [TypeOrmModule.forFeature([ErpPurchaseRequest])],
  controllers: [PurchaseRequestsCoreController],
  providers: [PurchaseRequestsCoreService],
  exports: [PurchaseRequestsCoreService],
})
export class PurchaseRequestsCoreModule {}
