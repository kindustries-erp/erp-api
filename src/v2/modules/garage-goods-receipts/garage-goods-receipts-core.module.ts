import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GarageGoodsReceipt } from './entities/garage-goods-receipt.entity';
import { GarageGoodsReceiptLine } from './entities/garage-goods-receipt-line.entity';
import { GarageInventoryBalance } from './entities/garage-inventory-balance.entity';
import { GarageGoodsReceiptController } from './controllers/garage-goods-receipt.controller';
import { GarageGoodsReceiptsCoreService } from './garage-goods-receipts-core.service';
import { GarageGoodsReceiptCommandService } from './services/garage-goods-receipt-command.service';
import { GarageGoodsReceiptQueryService } from './services/garage-goods-receipt-query.service';
import { GoodsReceiptsCoreModule } from '@/v2/core/goods-receipts/goods-receipts-core.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      GarageGoodsReceipt,
      GarageGoodsReceiptLine,
      GarageInventoryBalance,
    ]),
    GoodsReceiptsCoreModule,
  ],
  controllers: [GarageGoodsReceiptController],
  providers: [
    GarageGoodsReceiptsCoreService,
    GarageGoodsReceiptQueryService,
    GarageGoodsReceiptCommandService,
  ],
  exports: [GarageGoodsReceiptsCoreService],
})
export class GarageGoodsReceiptsCoreModule {}
