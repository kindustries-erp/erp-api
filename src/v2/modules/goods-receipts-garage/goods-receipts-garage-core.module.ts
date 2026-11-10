import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GarageGoodsReceipt } from './entities/garage-goods-receipt.entity';
import { GarageGoodsReceiptLine } from './entities/garage-goods-receipt-line.entity';
import { GarageInventoryBalance } from './entities/garage-inventory-balance.entity';
import { GarageGoodsReceiptController } from './controllers/garage-goods-receipt.controller';
import { GarageGoodsReceiptsCoreService } from './goods-receipts-garage-core.service';
import { GarageGoodsReceiptCommandService } from './services/garage-goods-receipt-command.service';
import { GarageGoodsReceiptQueryService } from './services/garage-goods-receipt-query.service';
import { GarageInventoryBalanceService } from './services/garage-inventory-balance.service';
import { GoodsReceiptsCoreModule } from '@/v2/core/goods-receipts-core/goods-receipts-core.module';
import { GarageProcurementOrdersModule } from '@/v2/modules/procurement-orders-garage/procurement-orders-garage.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      GarageGoodsReceipt,
      GarageGoodsReceiptLine,
      GarageInventoryBalance,
    ]),
    GoodsReceiptsCoreModule,
    GarageProcurementOrdersModule,
  ],
  controllers: [GarageGoodsReceiptController],
  providers: [
    GarageGoodsReceiptsCoreService,
    GarageGoodsReceiptQueryService,
    GarageGoodsReceiptCommandService,
    GarageInventoryBalanceService,
  ],
  exports: [GarageGoodsReceiptsCoreService],
})
export class GarageGoodsReceiptsCoreModule {}
