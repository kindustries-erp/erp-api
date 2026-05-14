import { Module } from '@nestjs/common';
import { SinvoiceController } from './sinvoice.controller';
import { SinvoiceService } from './sinvoice.service';

@Module({
  controllers: [SinvoiceController],
  providers: [SinvoiceService],
  exports: [SinvoiceService],
})
export class SinvoiceModule {}
