import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { BaseVoucherEngineService } from '@/v2/core/goods-receipts-core/services/base-voucher-engine.service';
import { AbstractProcurementFlowService } from '@/v2/core/procurement-flow-core';
import { GarageGoodsReceipt } from '@/v2/modules/goods-receipts-garage/entities/garage-goods-receipt.entity';
import { GarageGoodsReceiptLine } from '@/v2/modules/goods-receipts-garage/entities/garage-goods-receipt-line.entity';
import { GarageProcurementOrderFulfilmentService } from '@/v2/modules/procurement-orders-garage/services/procurement-order-fulfilment.service';
import {
  assertReceiptMatchesOrder,
  toFulfilmentItems,
  toStockDocument,
  toStockLines,
} from '../helpers/garage-receipt-flow.helper';
import { GarageProcurementFlowEventsService } from './garage-procurement-flow-events.service';
import { GarageProcurementFlowStockAdapter } from './garage-procurement-flow-stock.adapter';

/**
 * Facade luồng nhận hàng garage: khóa phiếu, kiểm trạng thái, rồi để lõi điều phối
 * (đơn mua → sổ garage_stock_* → sự kiện sau commit) trong một transaction.
 */
@Injectable()
export class GarageProcurementFlowService extends AbstractProcurementFlowService {
  constructor(
    protected readonly dataSource: DataSource,
    protected readonly events: GarageProcurementFlowEventsService,
    protected readonly fulfilment: GarageProcurementOrderFulfilmentService,
    protected readonly stock: GarageProcurementFlowStockAdapter,
    private readonly voucherEngine: BaseVoucherEngineService,
  ) {
    super();
  }

  async postReceipt(receiptId: string): Promise<GarageGoodsReceipt> {
    return this.runInTransaction(async (manager, emit) => {
      const receipt = await this.lockReceipt(manager, receiptId);
      this.voucherEngine.validateVoucherTransition(receipt.status, 'post');
      const lines = await this.loadLines(manager, receipt.id);
      if (lines.length === 0) {
        throw new BadRequestException('Phiếu nhập kho chưa có mặt hàng nào');
      }
      if (receipt.garageProcurementOrderId) {
        await assertReceiptMatchesOrder(manager, receipt, lines);
      }
      await this.applyReceipt(manager, emit, {
        orderId: receipt.garageProcurementOrderId ?? null,
        items: receipt.garageProcurementOrderId ? toFulfilmentItems(lines) : [],
        stock: { ...toStockDocument(receipt), lines: toStockLines(lines) },
      });
      receipt.status = 'POSTED';
      receipt.lines = lines;
      return manager.save(GarageGoodsReceipt, receipt);
    });
  }

  async cancelReceipt(receiptId: string): Promise<GarageGoodsReceipt> {
    return this.runInTransaction(async (manager, emit) => {
      const receipt = await this.lockReceipt(manager, receiptId);
      this.voucherEngine.validateVoucherTransition(receipt.status, 'cancel');
      if (receipt.status === 'POSTED') {
        const lines = await this.loadLines(manager, receipt.id);
        await this.revertReceipt(manager, emit, {
          orderId: receipt.garageProcurementOrderId ?? null,
          items: receipt.garageProcurementOrderId
            ? toFulfilmentItems(lines)
            : [],
          stock: toStockDocument(receipt),
        });
      }
      receipt.status = 'CANCELLED';
      return manager.save(GarageGoodsReceipt, receipt);
    });
  }

  /** Khóa phiếu để post/cancel không chạy song song trên cùng một phiếu. */
  private async lockReceipt(
    manager: EntityManager,
    id: string,
  ): Promise<GarageGoodsReceipt> {
    const receipt = await manager.findOne(GarageGoodsReceipt, {
      where: { id },
      lock: { mode: 'pessimistic_write' },
    });
    if (!receipt) throw new NotFoundException('Không tìm thấy phiếu nhập kho');
    return receipt;
  }

  private loadLines(manager: EntityManager, receiptId: string) {
    return manager.find(GarageGoodsReceiptLine, {
      where: { garageGoodsReceiptId: receiptId },
      order: { lineNo: 'ASC' },
    });
  }
}
