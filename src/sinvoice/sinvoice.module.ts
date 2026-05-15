import { Module } from '@nestjs/common';
import { SinvoiceController } from './sinvoice.controller';
import { SinvoiceService } from './sinvoice.service';
import { ViettelV2Module } from '../viettel-v2/viettel-v2.module';

@Module({
  imports: [ViettelV2Module],
  controllers: [SinvoiceController],
  providers: [SinvoiceService],
  exports: [SinvoiceService],
})
export class SinvoiceModule {}
