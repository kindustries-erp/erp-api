import { Module } from '@nestjs/common';
import { DashboardCoreController } from './dashboard-core.controller';
import { DashboardCoreService } from './dashboard-core.service';
import { ReportsCoreModule } from '../reports-core/reports-core.module';
import { InventoryCoreModule } from '../inventory-core/inventory-core.module';
import { BankTransactionsCoreModule } from '../bank-transactions-core/bank-transactions-core.module';
import { ErpInvoicesCoreModule } from '../erp-invoices-core/erp-invoices-core.module';
import { OperationalDocumentsModule } from '../operational-documents/operational-documents.module';
import { PurchaseOrdersCoreModule } from '../purchase-orders-core/purchase-orders-core.module';
import { OperatingExpensesCoreModule } from '../operating-expenses-core/operating-expenses-core.module';

@Module({
  imports: [
    ReportsCoreModule,
    InventoryCoreModule,
    BankTransactionsCoreModule,
    ErpInvoicesCoreModule,
    OperationalDocumentsModule,
    PurchaseOrdersCoreModule,
    OperatingExpensesCoreModule,
  ],
  controllers: [DashboardCoreController],
  providers: [DashboardCoreService],
})
export class DashboardCoreModule {}
