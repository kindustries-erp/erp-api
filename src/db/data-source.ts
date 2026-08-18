import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { CoreUser } from '../users/entities/core-user.entity';
import { CoreRefreshToken } from '../auth/entities/core-refresh-token.entity';
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
import { ErpBomCategory } from '../bom-config/entities/erp_bom_category.entity';
import { ErpBomAttributeDef } from '../bom-config/entities/erp_bom_attribute_def.entity';
import { ErpBomAttributeValue } from '../bom-config/entities/erp_bom_attribute_value.entity';
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
import { ErpInvoice } from '../erp-invoices-core/entities/erp_invoice.entity';
import { ErpInvoiceItem } from '../erp-invoices-core/entities/erp_invoice_item.entity';
import { ErpInvoiceVoucherNetOff } from '../erp-invoices-core/entities/erp_invoice_voucher_netoff.entity';
import { CompanyProfile } from '../company-profile/entities/company-profile.entity';
import { SysFile } from '../files/entities/sys-file.entity';
import { ErpInventoryTrackingSerial } from '../inventory-core/entities/erp_inventory_tracking_serial.entity';
import { ErpInventoryTrackingLot } from '../inventory-core/entities/erp_inventory_tracking_lot.entity';
import { ErpInventoryTrackingCustom } from '../inventory-core/entities/erp_inventory_tracking_custom.entity';
import { ErpTrackingPolicy } from '../inventory-core/entities/erp_tracking_policy.entity';
import { ErpTrackingCategory } from '../inventory-core/entities/erp_tracking_category.entity';
import { ErpBranch } from '../branches-core/entities/erp_branch.entity';
import { ErpAuditLog } from '../audit-core/entities/erp-audit-log.entity';
import { ErpItemType } from '../inventory-core/entities/erp_item_type.entity';
import { ErpUom } from '../inventory-core/entities/erp_uom.entity';
import { ErpVehicle } from '../erp-mfg-core/entities/erp_vehicle.entity';
import { SysTag } from '../tags-core/entities/sys_tag.entity';
import { SysEntityTag } from '../tags-core/entities/sys_entity_tag.entity';
import { ErpBankAccount } from '../bank-transactions-core/entities/erp_bank_account.entity';
import { ErpCashBook } from '../bank-transactions-core/entities/erp_cash_book.entity';
import { ErpBankTransaction } from '../bank-transactions-core/entities/erp_bank_transaction.entity';
import { ErpBankAccountBalance } from '../bank-transactions-core/entities/erp_bank_account_balance.entity';
import { ErpCashBookBalance } from '../bank-transactions-core/entities/erp_cash_book_balance.entity';
import { KgaraAuth } from '../kgara-api-core/entities/kgara_auth.entity';
import { KgaraBranch } from '../kgara-api-core/entities/kgara_branch.entity';
import { KgaraCase } from '../kgara-api-core/entities/kgara_case.entity';
import { KgaraReceivable } from '../kgara-api-core/entities/kgara_receivable.entity';
import { KgaraPayable } from '../kgara-api-core/entities/kgara_payable.entity';
import { KgaraCaseService } from '../kgara-api-core/entities/kgara_case_service.entity';
import { KgaraCaseLinkedInvoice } from '../kgara-api-core/entities/kgara_case_linked_invoice.entity';
import { GwSyncRun } from '../kgara-api-core/entities/kgara_sync_run.entity';
import { KgaraGrossProfit } from '../kgara-api-core/entities/kgara_gross_profit.entity';
import { KgaraCaseSettlement } from '../kgara-api-core/entities/kgara_case_settlement.entity';
import { ErpChartOfAccount } from '../accounting-core/entities/erp_chart_of_account.entity';
import { ErpJournalEntry } from '../accounting-core/entities/erp_journal_entry.entity';
import { ErpJournalEntryLine } from '../accounting-core/entities/erp_journal_entry_line.entity';
import { ErpSerialLifecycle } from '../inventory-core/entities/erp_serial_lifecycle.entity';
import { CoreNotification } from '../notifications/entities/core-notification.entity';
import { ErpInventoryAdjustment } from '../inventory-adjustments-core/entities/erp_inventory_adjustment.entity';
import { ErpInventoryAdjustmentLine } from '../inventory-adjustments-core/entities/erp_inventory_adjustment_line.entity';
import { SinvoiceDraft } from '../sinvoice/entities/sinvoice-draft.entity';
import { SinvoiceConfig } from '../sinvoice/entities/sinvoice-config.entity';
import { ErpAttachment } from '../erp-attachments-core/entities/erp_attachment.entity';
import { ErpInvoiceAttachment } from '../erp-invoices-core/entities/erp_invoice_attachment.entity';
import { ErpEmailMessage } from '../email-ingest/entities/erp_email_message.entity';
import { ErpEmailAttachment } from '../email-ingest/entities/erp_email_attachment.entity';
import { VinfastPartsCatalog } from '../vinfast-parts/entities/vinfast-parts-catalog.entity';
import { VinfastPartsLedger } from '../vinfast-parts/entities/vinfast-parts-ledger.entity';
const entities = [
  CoreUser,
  CoreRefreshToken,
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
  ErpBomCategory,
  ErpBomAttributeDef,
  ErpBomAttributeValue,
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
  ErpInvoice,
  ErpInvoiceItem,
  ErpInvoiceVoucherNetOff,
  CompanyProfile,
  SysFile,
  ErpInventoryTrackingSerial,
  ErpInventoryTrackingLot,
  ErpInventoryTrackingCustom,
  ErpTrackingPolicy,
  ErpTrackingCategory,
  ErpBranch,
  ErpAuditLog,
  ErpItemType,
  ErpUom,
  ErpVehicle,
  SysTag,
  SysEntityTag,
  ErpBankAccount,
  ErpCashBook,
  ErpBankTransaction,
  ErpBankAccountBalance,
  ErpCashBookBalance,
  KgaraAuth,
  KgaraBranch,
  KgaraCase,
  KgaraReceivable,
  KgaraPayable,
  KgaraCaseService,
  KgaraCaseLinkedInvoice,
  KgaraGrossProfit,
  KgaraCaseSettlement,
  GwSyncRun,
  ErpChartOfAccount,
  ErpJournalEntry,
  ErpJournalEntryLine,
  ErpSerialLifecycle,
  CoreNotification,
  ErpInventoryAdjustment,
  ErpInventoryAdjustmentLine,
  SinvoiceDraft,
  SinvoiceConfig,
  ErpAttachment,
  ErpInvoiceAttachment,
  ErpEmailMessage,
  ErpEmailAttachment,
  VinfastPartsCatalog,
  VinfastPartsLedger,
];

const databaseUrl = process.env.DATABASE_URL;

export default new DataSource(
  databaseUrl
    ? {
        type: 'postgres',
        url: databaseUrl,
        schema: 'public',
        entities,
        migrations: [
          __dirname + '/migrations/**/*{.ts,.js}',
          __dirname + '/../migrations/**/*{.ts,.js}',
        ],
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
        schema: 'public',
        entities,
        migrations: [
          __dirname + '/migrations/**/*{.ts,.js}',
          __dirname + '/../migrations/**/*{.ts,.js}',
        ],
        synchronize: false,
        ssl:
          process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
      },
);
