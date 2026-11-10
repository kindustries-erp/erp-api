import { Entity, Index } from 'typeorm';
import { BaseStockTransactionEntity } from '@/v2/core/inventory-movements-core';

/** Sổ giao dịch tồn Garage. Chỉ ghi thêm, không sửa hay xóa. */
@Entity('garage_stock_transactions')
@Index('ix_garage_stock_transactions_document', ['documentType', 'documentId'])
@Index('ix_garage_stock_transactions_item', [
  'ledgerScope',
  'branchId',
  'itemCode',
  'transactionDate',
])
export class InventoryMovementsGarageTransaction extends BaseStockTransactionEntity {}
