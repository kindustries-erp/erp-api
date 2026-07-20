import { ReportsCoreModule } from './reports-core/reports-core.module';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { CoreUser } from './users/entities/core-user.entity';
import { CoreRole } from './rbac-core/entities/core-role.entity';
import { CorePermission } from './rbac-core/entities/core-permission.entity';
import { CoreUserRole } from './rbac-core/entities/core-user-role.entity';
import { EmployeesCoreModule } from './employees-core/employees-core.module';
import { BusinessPartnersCoreModule } from './business-partners-core/business-partners-core.module';
import { InventoryCoreModule } from './inventory-core/inventory-core.module';
import { BomCoreModule } from './bom-core/bom-core.module';
import { PurchaseRequestsCoreModule } from './purchase-requests-core/purchase-requests-core.module';
import { PurchaseOrdersCoreModule } from './purchase-orders-core/purchase-orders-core.module';
import { GoodsReceiptsCoreModule } from './goods-receipts-core/goods-receipts-core.module';
import { GoodsIssuesCoreModule } from './goods-issues-core/goods-issues-core.module';
import { SalesOrdersCoreModule } from './sales-orders-core/sales-orders-core.module';
import { ProductionCoreModule } from './production-core/production-core.module';
import { BranchesCoreModule } from './branches-core/branches-core.module';
import { SalesServiceOrdersCoreModule } from './sales-service-orders-core/sales-service-orders-core.module';
import { InventoryStockCoreModule } from './inventory-stock-core/inventory-stock-core.module';
import { ErpMfgCoreModule } from './erp-mfg-core/erp-mfg-core.module';
import { AuditCoreModule } from './audit-core/audit-core.module';
import { UsersAdminModule } from './users-admin/users-admin.module';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { GlobalAuditInterceptor } from './audit-core/interceptors/global-audit.interceptor';
import { RbacCoreModule } from './rbac-core/rbac-core.module';
import { BasicMastersCoreModule } from './basic-masters-core/basic-masters-core.module';
import { DocumentDependenciesCoreModule } from './document-dependencies-core/document-dependencies-core.module';
import { ErpInvoicesCoreModule } from './erp-invoices-core/erp-invoices-core.module';
import { CompanyProfileModule } from './company-profile/company-profile.module';
import { FilesModule } from './files/files.module';
import { ScheduleModule } from '@nestjs/schedule';
import { CommonModule } from './common/common.module';
import { TagsCoreModule } from './tags-core/tags-core.module';
import { BankTransactionsCoreModule } from './bank-transactions-core/bank-transactions-core.module';
import { KgaraApiCoreModule } from './kgara-api-core/kgara-api-core.module';
import { AccountingCoreModule } from './accounting-core/accounting-core.module';
import { PublicWarrantyModule } from './public-warranty/public-warranty.module';
import { NotificationsModule } from './notifications/notifications.module';
import { DashboardCoreModule } from './dashboard-core/dashboard-core.module';
import { InventoryAdjustmentsCoreModule } from './inventory-adjustments-core/inventory-adjustments-core.module';

@Module({
  imports: [
    ...(process.env.APP_ENV?.endsWith('-production') ||
    process.env.NODE_ENV === 'production'
      ? [ScheduleModule.forRoot()]
      : []),
    ReportsCoreModule,
    CommonModule,
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const databaseUrl = configService.get<string>('DATABASE_URL');
        if (databaseUrl) {
          return {
            type: 'postgres' as const,
            schema: 'public',
            url: databaseUrl,
            entities: [CoreUser, CoreRole, CorePermission, CoreUserRole],
            synchronize: false,
            ssl: { rejectUnauthorized: false },
            autoLoadEntities: true,
            retryAttempts: 2,
          };
        }

        return {
          type: 'postgres' as const,
          schema: 'public',
          host: configService.get<string>('DB_HOST', '127.0.0.1'),
          port: Number(configService.get<number>('DB_PORT', 5432)),
          username: configService.get<string>('DB_USER', 'postgres'),
          password: configService.get<string>('DB_PASSWORD', ''),
          database: configService.get<string>('DB_DATABASE', 'erp_core'),
          entities: [CoreUser, CoreRole, CorePermission, CoreUserRole],
          synchronize: false,
          ssl:
            configService.get<string>('DB_SSL') === 'true'
              ? { rejectUnauthorized: false }
              : false,
          autoLoadEntities: true,
          retryAttempts: 2,
        };
      },
    }),
    AuthModule,
    EmployeesCoreModule,
    BusinessPartnersCoreModule,
    InventoryCoreModule,
    BomCoreModule,
    PurchaseRequestsCoreModule,
    PurchaseOrdersCoreModule,
    GoodsReceiptsCoreModule,
    GoodsIssuesCoreModule,
    SalesOrdersCoreModule,
    ProductionCoreModule,
    BranchesCoreModule,
    SalesServiceOrdersCoreModule,
    InventoryStockCoreModule,
    ErpMfgCoreModule,
    AuditCoreModule,
    UsersAdminModule,
    RbacCoreModule,
    BasicMastersCoreModule,
    DocumentDependenciesCoreModule,
    ErpInvoicesCoreModule,
    CompanyProfileModule,
    FilesModule,
    TagsCoreModule,
    BankTransactionsCoreModule,
    KgaraApiCoreModule,
    AccountingCoreModule,
    PublicWarrantyModule,
    NotificationsModule,
    DashboardCoreModule,
    InventoryAdjustmentsCoreModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_INTERCEPTOR,
      useClass: GlobalAuditInterceptor,
    },
  ],
})
export class AppModule {}
