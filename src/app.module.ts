import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DirectusModule } from './directus/directus.module';
import { AuthModule } from './auth/auth.module';
import { EmployeesModule } from './employees/employees.module';
import { DepartmentsModule } from './departments/departments.module';
import { PositionsModule } from './positions/positions.module';
import { CompanyBankAccountsModule } from './company-bank-accounts/company-bank-accounts.module';
import { BusinessPartnerRolesModule } from './business-partner-roles/business-partner-roles.module';
import { ChartOfAccountsModule } from './chart-of-accounts/chart-of-accounts.module';
import { ActivityLogsModule } from './activity-logs/activity-logs.module';
import { BusinessPartnersModule } from './business-partners/business-partners.module';
import { BusinessPartnerContactsModule } from './business-partner-contacts/business-partner-contacts.module';
import { BusinessPartnerBankAccountsModule } from './business-partner-bank-accounts/business-partner-bank-accounts.module';
import { CashFundsModule } from './cash-funds/cash-funds.module';
import { OpeningBalancesModule } from './opening-balances/opening-balances.module';
import { PaymentVouchersModule } from './payment-vouchers/payment-vouchers.module';
import { PaymentVoucherAttachmentsModule } from './payment-voucher-attachments/payment-voucher-attachments.module';
import { CashflowVoucherAttachmentsModule } from './cashflow-voucher-attachments/cashflow-voucher-attachments.module';
import { VoucherNumberingConfigsModule } from './voucher-numbering-configs/voucher-numbering-configs.module';
import { FilesModule } from './files/files.module';
import { RbacModule } from './rbac/rbac.module';
import { PartnerLedgerItemsModule } from './partner-ledger-items/partner-ledger-items.module';
import { PartnerLedgerSettlementsModule } from './partner-ledger-settlements/partner-ledger-settlements.module';
import { WorkflowGraphModule } from './workflow-graph/workflow-graph.module';
import { JournalEntriesModule } from './journal-entries/journal-entries.module';
import { SinvoiceModule } from './sinvoice/sinvoice.module';
import { ViettelV2Module } from './viettel-v2/viettel-v2.module';
import { BranchesModule } from './branches/branches.module';
import { OperationalDocumentsModule } from './operational-documents/operational-documents.module';
import { AuditLogsModule } from './audit-logs/audit-logs.module';
import { CashflowVouchersModule } from './cashflow-vouchers/cashflow-vouchers.module';

@Module({
  imports: [
    // Tải .env toàn cục, không cần import ConfigModule ở các module con
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    // Directus SDK client (global provider)
    DirectusModule,
    // Register + Login
    AuthModule,
    EmployeesModule,
    DepartmentsModule,
    PositionsModule,
    CompanyBankAccountsModule,
    BusinessPartnerRolesModule,
    ChartOfAccountsModule,
    ActivityLogsModule,
    BusinessPartnersModule,
    BusinessPartnerContactsModule,
    BusinessPartnerBankAccountsModule,
    CashFundsModule,
    OpeningBalancesModule,
    PaymentVouchersModule,
    PaymentVoucherAttachmentsModule,
    CashflowVoucherAttachmentsModule,
    VoucherNumberingConfigsModule,
    FilesModule,
    RbacModule,
    PartnerLedgerItemsModule,
    PartnerLedgerSettlementsModule,
    BranchesModule,
    WorkflowGraphModule,
    JournalEntriesModule,
    SinvoiceModule,
    ViettelV2Module,
    OperationalDocumentsModule,
    AuditLogsModule,
    CashflowVouchersModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
