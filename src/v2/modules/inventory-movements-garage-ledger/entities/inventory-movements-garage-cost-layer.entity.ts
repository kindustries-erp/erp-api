import { Entity, Index } from 'typeorm';
import { BaseStockCostLayerEntity } from '@/v2/core/inventory-movements-core';

/** Lớp giá FIFO của tồn Garage (dùng khi cấu hình ledger là FIFO). */
@Entity('garage_stock_cost_layers')
@Index('ix_garage_stock_cost_layers_fifo', [
  'ledgerScope',
  'branchId',
  'itemCode',
  'receivedAt',
])
export class InventoryMovementsGarageCostLayer extends BaseStockCostLayerEntity {}
