import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import {
  StockMovementEngineService,
  type StockDocumentContext,
} from '@/v2/core/inventory-movements-core';
import type {
  ProcurementFlowStockDocument,
  ProcurementFlowStockInput,
  ProcurementReceiptStockPort,
} from '@/v2/core/procurement-flow-core';
import { INVENTORY_MOVEMENTS_GARAGE_LEDGER } from '@/v2/modules/inventory-movements-garage-ledger/config/inventory-movements-garage-ledger.config';

/**
 * Cổng ghi sổ tồn của luồng mua garage: ghi nhập và đảo qua engine chung của sổ garage_stock_*.
 * Phiếu nhập kho (goods_receipts_garage) là chứng từ gốc, không tạo thêm phiếu nhập trong sổ.
 */
@Injectable()
export class GarageProcurementFlowStockAdapter implements ProcurementReceiptStockPort {
  constructor(private readonly engine: StockMovementEngineService) {}

  async post(
    manager: EntityManager,
    input: ProcurementFlowStockInput,
  ): Promise<void> {
    await this.engine.post(
      manager,
      INVENTORY_MOVEMENTS_GARAGE_LEDGER,
      this.contextOf(input),
      input.lines.map((line) => ({
        itemCode: line.itemCode,
        itemName: line.itemName,
        unit: line.unit,
        qty: line.qty,
        direction: 'IN' as const,
        transactionType: 'RECEIPT' as const,
        unitCost: line.unitCost,
      })),
    );
  }

  async reverse(
    manager: EntityManager,
    document: ProcurementFlowStockDocument,
  ): Promise<void> {
    await this.engine.reverse(
      manager,
      INVENTORY_MOVEMENTS_GARAGE_LEDGER,
      this.contextOf(document),
    );
  }

  private contextOf(doc: ProcurementFlowStockDocument): StockDocumentContext {
    return {
      branchId: doc.branchId,
      documentType: doc.documentType,
      documentId: doc.documentId,
      transactionDate: doc.transactionDate,
      createdBy: doc.createdBy,
    };
  }
}
