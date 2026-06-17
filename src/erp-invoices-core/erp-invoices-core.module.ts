import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { ErpInvoice } from './entities/erp_invoice.entity';
import { ErpInvoiceItem } from './entities/erp_invoice_item.entity';
import { ErpInvoicesCoreService } from './erp-invoices-core.service';
import { ErpInvoicesCoreController } from './erp-invoices-core.controller';
import { R2Service } from './r2/r2.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([ErpInvoice, ErpInvoiceItem]),
    ConfigModule,
  ],
  controllers: [ErpInvoicesCoreController],
  providers: [ErpInvoicesCoreService, R2Service],
  exports: [ErpInvoicesCoreService],
})
export class ErpInvoicesCoreModule {}
