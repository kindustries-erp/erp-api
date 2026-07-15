import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { ErpInvoice } from './entities/erp_invoice.entity';
import { ErpInvoiceItem } from './entities/erp_invoice_item.entity';
import { ErpInvoiceVoucherNetOff } from './entities/erp_invoice_voucher_netoff.entity';
import { CompanyProfile } from '../company-profile/entities/company-profile.entity';
import { ErpInvoicesCoreService } from './erp-invoices-core.service';
import { ErpInvoicesCoreController } from './erp-invoices-core.controller';
import { InvoiceDashboardService } from './invoice-dashboard.service';
import { InvoiceDashboardController } from './invoice-dashboard.controller';
import { R2Module } from '../r2/r2.module';
import { BankTransactionsCoreModule } from '../bank-transactions-core/bank-transactions-core.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ErpInvoice,
      ErpInvoiceItem,
      ErpInvoiceVoucherNetOff,
      CompanyProfile,
    ]),
    R2Module,
    BankTransactionsCoreModule,
    NotificationsModule,
  ],
  controllers: [ErpInvoicesCoreController, InvoiceDashboardController],
  providers: [ErpInvoicesCoreService, InvoiceDashboardService],
  exports: [ErpInvoicesCoreService, InvoiceDashboardService],
})
export class ErpInvoicesCoreModule {}
