import { Module } from '@nestjs/common';
import { VoucherNumberingConfigsController } from './voucher-numbering-configs.controller';
import { VoucherNumberingConfigsService } from './voucher-numbering-configs.service';

@Module({
  controllers: [VoucherNumberingConfigsController],
  providers: [VoucherNumberingConfigsService],
})
export class VoucherNumberingConfigsModule {}
