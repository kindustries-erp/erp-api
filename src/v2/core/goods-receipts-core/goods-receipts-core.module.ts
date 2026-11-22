import { Module } from '@nestjs/common';
import { BaseVoucherEngineService } from './services/base-voucher-engine.service';

@Module({
  providers: [BaseVoucherEngineService],
  exports: [BaseVoucherEngineService],
})
export class GoodsReceiptsCoreModule {}
