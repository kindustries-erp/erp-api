import { Module } from '@nestjs/common';
import { BaseInvoiceEngineService } from './services/base-invoice-engine.service';

@Module({
  providers: [BaseInvoiceEngineService],
  exports: [BaseInvoiceEngineService],
})
export class InvoicesCoreModule {}
