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
import { InvoiceLifecycleService } from './services/invoice-lifecycle.service';
import { InvoicePortalService } from './services/invoice-portal.service';
import { InvoiceImportService } from './services/invoice-import.service';
import { InvoiceFilesService } from './services/invoice-files.service';
import { InvoiceQueryService } from './services/invoice-query.service';
import { InvoiceExportBackgroundService } from './services/invoice-export-background.service';
import { InvoiceSmartNetoffService } from './services/invoice-smart-netoff.service';
import { ErpInvoiceAttachment } from './entities/erp_invoice_attachment.entity';
import { ErpInvoiceItemSubscriber } from './subscribers/erp-invoice-item.subscriber';
import { ErpAttachmentsCoreModule } from '../erp-attachments-core/erp-attachments-core.module';
import { ErpBranch } from '../branches-core/entities/erp_branch.entity';
import { ErpEntityAttributeValue } from '../module-config/entities/erp_entity_attribute_value.entity';

import { VinfastPartsModule } from '../vinfast-parts/vinfast-parts.module';

import { InvoiceDebtsService } from './services/invoice-debts.service';
import { InvoiceDebtsExportBackgroundService } from './services/invoice-debts-export-background.service';
import { InvoiceDebtsController } from './controllers/invoice-debts.controller';
import { InvoiceDebtsQueryService } from './services/sub-services/invoice-debts-query.service';
import { InvoiceDebtsDetailService } from './services/sub-services/invoice-debts-detail.service';
import { InvoiceDebtsExportService } from './services/sub-services/invoice-debts-export.service';
import { InvoiceListQueryService } from './services/sub-services/invoice-list-query.service';
import { InvoiceExportExcelService } from './services/sub-services/invoice-export-excel.service';
import { InvoiceStatsService } from './services/sub-services/invoice-stats.service';
import { InvoiceItemsQueryService } from './services/sub-services/invoice-items-query.service';
import { InvoiceItemsExportService } from './services/sub-services/invoice-items-export.service';
import { InvoiceDashboardStatsService } from './services/sub-services/invoice-dashboard-stats.service';
import { InvoiceDashboardPartnersService } from './services/sub-services/invoice-dashboard-partners.service';
import { InvoiceDashboardExportService } from './services/sub-services/invoice-dashboard-export.service';
import { InvoiceDashboardAnalyticsService } from './services/sub-services/invoice-dashboard-analytics.service';
import { InvoiceDashboardHorizonService } from './services/sub-services/invoice-dashboard-horizon.service';

import { ErpModuleCategory } from '../module-config/entities/erp_module_category.entity';
import { ErpChartOfAccount } from '../accounting-core/entities/erp_chart_of_account.entity';
import { ErpJournalEntry } from '../accounting-core/entities/erp_journal_entry.entity';
import { ErpJournalEntryLine } from '../accounting-core/entities/erp_journal_entry_line.entity';
import { AiHubCoreModule } from '../ai-hub-core/ai-hub-core.module';
import { InvoiceCategoryAutopostService } from './services/sub-services/invoice-category-autopost.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ErpInvoice,
      ErpInvoiceItem,
      ErpInvoiceVoucherNetOff,
      ErpInvoiceAttachment,
      CompanyProfile,
      CorePermission,
      CoreUserRole,
      ErpBranch,
      ErpEntityAttributeValue,
      ErpModuleCategory,
      ErpChartOfAccount,
      ErpJournalEntry,
      ErpJournalEntryLine,
    ]),
    R2Module,
    BankTransactionsCoreModule,
    NotificationsModule,
    AccountingCoreModule,
    AiHubCoreModule,
    ErpAttachmentsCoreModule,
    VinfastPartsModule,
  ],
  controllers: [
    InvoiceDebtsController,
    InvoiceDashboardController,
    ErpInvoicesCoreController,
  ],
  providers: [
    InvoiceLifecycleService,
    InvoicePortalService,
    InvoiceImportService,
    InvoiceFilesService,
    InvoiceQueryService,
    InvoiceListQueryService,
    InvoiceExportExcelService,
    InvoiceStatsService,
    InvoiceItemsQueryService,
    InvoiceItemsExportService,
    InvoiceExportBackgroundService,
    InvoiceSmartNetoffService,
    InvoiceDebtsService,
    InvoiceDebtsQueryService,
    InvoiceDebtsDetailService,
    InvoiceDebtsExportService,
    InvoiceDebtsExportBackgroundService,
    InvoiceDashboardStatsService,
    InvoiceDashboardPartnersService,
    InvoiceDashboardExportService,
    InvoiceDashboardAnalyticsService,
    InvoiceDashboardHorizonService,
    InvoiceCategoryAutopostService,
    ErpInvoicesCoreService,
    InvoiceDashboardService,
    ErpInvoicesCronService,
    ErpInvoiceItemSubscriber,
  ],
  exports: [
    ErpInvoicesCoreService,
    InvoiceDashboardService,
    InvoiceSmartNetoffService,
    InvoiceDebtsService,
    InvoiceDebtsExportBackgroundService,
    InvoiceCategoryAutopostService,
  ],
})
export class ErpInvoicesCoreModule {}
