import { Entity, Index } from 'typeorm';
import { BaseStockBalanceEntity } from '@/v2/core/inventory-movements-core';

/** Số dư tồn riêng của Garage. Hai unique index partial tách dòng chi nhánh null. */
@Entity('garage_stock_balances')
@Index(
  'ux_garage_stock_balances_scope_branch_item',
  ['ledgerScope', 'branchId', 'itemCode'],
  {
    unique: true,
    where: '"branch_id" IS NOT NULL',
  },
)
@Index(
  'ux_garage_stock_balances_scope_nobranch_item',
  ['ledgerScope', 'itemCode'],
  {
    unique: true,
    where: '"branch_id" IS NULL',
  },
)
export class InventoryMovementsGarageBalance extends BaseStockBalanceEntity {}
