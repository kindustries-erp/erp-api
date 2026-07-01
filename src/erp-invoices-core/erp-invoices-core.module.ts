import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { ErpInvoice } from './entities/erp_invoice.entity';
import { ErpInvoiceItem } from './entities/erp_invoice_item.entity';
import { ErpInvoiceVoucherNetOff } from './entities/erp_invoice_voucher_netoff.entity';
import { ErpInvoicesCoreService } from './erp-invoices-core.service';
import { ErpInvoicesCoreController } from './erp-invoices-core.controller';
import { R2Module } from '../r2/r2.module';
import { AccountingCoreModule } from '../accounting-core/accounting-core.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ErpInvoice,
      ErpInvoiceItem,
      ErpInvoiceVoucherNetOff,
    ]),
    R2Module,
    AccountingCoreModule,
  ],
  controllers: [ErpInvoicesCoreController],
  providers: [ErpInvoicesCoreService],
  exports: [ErpInvoicesCoreService],
})
export class ErpInvoicesCoreModule {}
