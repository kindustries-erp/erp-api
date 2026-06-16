import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { CoreUser } from '../users/entities/core-user.entity';
import { CoreRole } from '../rbac-core/entities/core-role.entity';
import { CorePermission } from '../rbac-core/entities/core-permission.entity';
import { CoreUserRole } from '../rbac-core/entities/core-user-role.entity';
import { ErpEmployee } from '../employees-core/entities/erp_employee.entity';
import { ErpBusinessPartner } from '../business-partners-core/entities/erp_business_partner.entity';
import { ErpInventoryItem } from '../inventory-core/entities/erp_inventory_item.entity';
import { ErpInventoryTransaction } from '../inventory-core/entities/erp_inventory_transaction.entity';
import { ErpInventoryBalance } from '../inventory-core/entities/erp_inventory_balance.entity';
import { ErpBom } from '../bom-core/entities/erp_bom.entity';
import { ErpBomLine } from '../bom-core/entities/erp_bom_line.entity';
import { ErpPurchaseRequest } from '../purchase-requests-core/entities/erp_purchase_request.entity';
import { ErpPurchaseRequestLine } from '../purchase-requests-core/entities/erp_purchase_request_line.entity';
import { ErpPurchaseOrder } from '../purchase-orders-core/entities/erp_purchase_order.entity';
import { ErpPurchaseOrderLine } from '../purchase-orders-core/entities/erp_purchase_order_line.entity';
import { ErpGoodsReceipt } from '../goods-receipts-core/entities/erp_goods_receipt.entity';
import { ErpGoodsReceiptLine } from '../goods-receipts-core/entities/erp_goods_receipt_line.entity';
import { ErpGoodsIssue } from '../goods-issues-core/entities/erp_goods_issue.entity';
import { ErpGoodsIssueLine } from '../goods-issues-core/entities/erp_goods_issue_line.entity';
import { ErpSalesOrder } from '../sales-orders-core/entities/erp_sales_order.entity';
import { ErpSalesOrderLine } from '../sales-orders-core/entities/erp_sales_order_line.entity';
import { ErpProductionOrder } from '../production-core/entities/erp_production_order.entity';
import { ErpProductionOrderMaterial } from '../production-core/entities/erp_production_order_material.entity';
import { ErpChartOfAccount } from '../journal-entries/entities/erp_chart_of_account.entity';
import { ErpAccountingPeriod } from '../journal-entries/entities/erp_accounting_period.entity';
import { ErpJournalEntry } from '../journal-entries/entities/erp_journal_entry.entity';
import { ErpJournalEntryLine } from '../journal-entries/entities/erp_journal_entry_line.entity';
import { ErpJournalEntryAttachment } from '../journal-entries/entities/erp_journal_entry_attachment.entity';
import { ErpModuleAccountingConfig } from '../accounting-configs-core/entities/erp_module_accounting_config.entity';

const entities = [
  CoreUser,
  CoreRole,
  CorePermission,
  CoreUserRole,
  ErpEmployee,
  ErpBusinessPartner,
  ErpInventoryItem,
  ErpInventoryTransaction,
  ErpInventoryBalance,
  ErpBom,
  ErpBomLine,
  ErpPurchaseRequest,
  ErpPurchaseRequestLine,
  ErpPurchaseOrder,
  ErpPurchaseOrderLine,
  ErpGoodsReceipt,
  ErpGoodsReceiptLine,
  ErpGoodsIssue,
  ErpGoodsIssueLine,
  ErpSalesOrder,
  ErpSalesOrderLine,
  ErpProductionOrder,
  ErpProductionOrderMaterial,
  ErpChartOfAccount,
  ErpAccountingPeriod,
  ErpJournalEntry,
  ErpJournalEntryLine,
  ErpJournalEntryAttachment,
  ErpModuleAccountingConfig,
];

const databaseUrl = process.env.DATABASE_URL;

export default new DataSource(
  databaseUrl
    ? {
        type: 'postgres',
        url: databaseUrl,
        entities,
        migrations: [__dirname + '/../migrations/**/*{.ts,.js}'],
        synchronize: false,
        ssl: { rejectUnauthorized: false },
      }
    : {
        type: 'postgres',
        host: process.env.DB_HOST || '127.0.0.1',
        port: Number(process.env.DB_PORT || 5432),
        username: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_DATABASE || 'erp_core',
        entities,
        migrations: [__dirname + '/../migrations/**/*{.ts,.js}'],
        synchronize: false,
        ssl:
          process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
      },
);
