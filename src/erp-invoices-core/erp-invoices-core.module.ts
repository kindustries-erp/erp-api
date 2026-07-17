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
import { AccountingCoreModule } from '../accounting-core/accounting-core.module';
import { CorePermission } from '../rbac-core/entities/core-permission.entity';
import { CoreUserRole } from '../rbac-core/entities/core-user-role.entity';
import { ErpInvoicesCronService } from './erp-invoices-cron.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ErpInvoice,
      ErpInvoiceItem,
      ErpInvoiceVoucherNetOff,
      CompanyProfile,
      CorePermission,
      CoreUserRole,
    ]),
    R2Module,
    BankTransactionsCoreModule,
    NotificationsModule,
    AccountingCoreModule,
  ],
  controllers: [ErpInvoicesCoreController, InvoiceDashboardController],
  providers: [
    ErpInvoicesCoreService,
    InvoiceDashboardService,
    ErpInvoicesCronService,
  ],
  exports: [ErpInvoicesCoreService, InvoiceDashboardService],
})
export class ErpInvoicesCoreModule {}
