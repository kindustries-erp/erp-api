import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { ErpInvoice } from './entities/erp_invoice.entity';
import { ErpEInvoiceSync } from './entities/erp_einvoice_sync.entity';
import { ErpInvoiceItem } from './entities/erp_invoice_item.entity';
import { ErpInvoiceVoucherNetOff } from './entities/erp_invoice_voucher_netoff.entity';
import { ErpInvoiceAdjustmentNetOff } from './entities/erp_invoice_adjustment_netoff.entity';
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
import { ErpModuleAttributeDef } from '../module-config/entities/erp_module_attribute_def.entity';
import { ErpChartOfAccount } from '../accounting-core/entities/erp_chart_of_account.entity';
import { ErpJournalEntry } from '../accounting-core/entities/erp_journal_entry.entity';
import { ErpJournalEntryLine } from '../accounting-core/entities/erp_journal_entry_line.entity';
import { AiHubCoreModule } from '../ai-hub-core/ai-hub-core.module';
import { InvoiceCategoryAutopostService } from './services/sub-services/invoice-category-autopost.service';
import { InvoiceCategoryMemoryService } from './services/sub-services/invoice-category-memory.service';
import { InvoiceItemCodeResolverService } from './services/sub-services/invoice-item-code-resolver.service';
import { InvoiceAdjustmentService } from './services/sub-services/invoice-adjustment.service';

import { InvoiceOriginalPdfController } from './controllers/invoice-original-pdf.controller';
import { InvoiceOriginalPdfFacade } from './services/original-pdf/invoice-original-pdf.facade';
import { InvoiceProviderDetectorService } from './services/original-pdf/invoice-provider-detector.service';
import { InvoiceCaptchaSolverService } from './services/original-pdf/invoice-captcha-solver.service';
import { InvoicePdfDownloadWorkerService } from './services/original-pdf/invoice-pdf-download-worker.service';
import { ProviderAdapterRegistry } from './services/adapters/provider-adapter.registry';
import { VinfastInvoiceAdapter } from './services/adapters/vinfast-invoice.adapter';
import { EasyInvoiceAdapter } from './services/adapters/easy-invoice.adapter';
import { MisaInvoiceAdapter } from './services/adapters/misa-invoice.adapter';
import { ViettelInvoiceAdapter } from './services/adapters/viettel-invoice.adapter';
import { HiloInvoiceAdapter } from './services/adapters/hilo-invoice.adapter';
import { CyberbillInvoiceAdapter } from './services/adapters/cyberbill-invoice.adapter';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ErpInvoice,
      ErpEInvoiceSync,
      ErpInvoiceItem,
      ErpInvoiceVoucherNetOff,
      ErpInvoiceAdjustmentNetOff,
      ErpInvoiceAttachment,
      CompanyProfile,
      CorePermission,
      CoreUserRole,
      ErpBranch,
      ErpEntityAttributeValue,
      ErpModuleCategory,
      ErpModuleAttributeDef,
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
    InvoiceOriginalPdfController,
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
    InvoiceCategoryMemoryService,
    InvoiceItemCodeResolverService,
    InvoiceAdjustmentService,
    InvoiceProviderDetectorService,
    InvoiceCaptchaSolverService,
    ProviderAdapterRegistry,
    VinfastInvoiceAdapter,
    EasyInvoiceAdapter,
    MisaInvoiceAdapter,
    ViettelInvoiceAdapter,
    HiloInvoiceAdapter,
    CyberbillInvoiceAdapter,
    InvoicePdfDownloadWorkerService,
    InvoiceOriginalPdfFacade,
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
    InvoiceItemCodeResolverService,
    InvoiceAdjustmentService,
    InvoiceOriginalPdfFacade,
    InvoiceProviderDetectorService,
  ],
})
export class ErpInvoicesCoreModule {}
