import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ErpInvoice } from './entities/erp_invoice.entity';
import { ErpInvoicesCoreService } from './erp-invoices-core.service';
import { ErpInvoicesCoreController } from './erp-invoices-core.controller';

@Module({
  imports: [TypeOrmModule.forFeature([ErpInvoice])],
  controllers: [ErpInvoicesCoreController],
  providers: [ErpInvoicesCoreService],
  exports: [ErpInvoicesCoreService],
})
export class ErpInvoicesCoreModule {}
