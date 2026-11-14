import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { BaseVoucherEngineService } from '@/v2/core/goods-receipts-core/services/base-voucher-engine.service';
import {
  AbstractProcurementFlowService,
  type ProcurementFlowEvent,
  type SaveAndActPort,
} from '@/v2/core/procurement-flow-core';
import { GarageGoodsReceipt } from '@/v2/modules/goods-receipts-garage/entities/garage-goods-receipt.entity';
import { GarageGoodsReceiptLine } from '@/v2/modules/goods-receipts-garage/entities/garage-goods-receipt-line.entity';
import { GarageLineItemResolver } from '@/v2/modules/items-garage/services/garage-line-item-resolver.service';
import { GarageProcurementOrderFulfilmentService } from '@/v2/modules/procurement-orders-garage/services/procurement-order-fulfilment.service';
import {
  assertGoodsUnused,
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
    private readonly itemResolver: GarageLineItemResolver,
  ) {
    super();
  }

  postReceipt(receiptId: string): Promise<GarageGoodsReceipt> {
    return this.runInTransaction((manager, emit) =>
      this.postReceiptIn(manager, emit, receiptId),
    );
  }

  /** Lưu phiếu (do `save` đảm nhiệm) rồi ghi sổ, cùng một transaction, sự kiện phát sau commit. */
  saveAndPost(
    save: (manager: EntityManager) => Promise<{ id: string }>,
  ): Promise<GarageGoodsReceipt> {
    const port: SaveAndActPort<null, GarageGoodsReceipt> = {
      save: (manager) => save(manager),
      act: (manager, emit, id) => this.postReceiptIn(manager, emit, id),
    };
    return this.saveAndAct(port, null, null);
  }

  /** Thân ghi sổ: dùng chung cho post riêng lẻ và save-and-post (manager do orchestrator giữ). */
  private async postReceiptIn(
    manager: EntityManager,
    emit: (event: ProcurementFlowEvent) => void,
    receiptId: string,
  ): Promise<GarageGoodsReceipt> {
    const receipt = await this.lockReceipt(manager, receiptId);
    this.voucherEngine.validateVoucherTransition(receipt.status, 'post');
    const lines = await this.loadLines(manager, receipt.id);
    if (lines.length === 0) {
      throw new BadRequestException('Phiếu nhập kho chưa có mặt hàng nào');
    }
    await this.fillMissingItemCodes(manager, lines);
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
  }

  /**
   * Phiếu nháp cũ có dòng thiếu mã hàng: cấp mã theo danh mục trước khi ghi sổ (sổ tồn từ chối dòng thiếu mã)
   * và lưu mã vào dòng phiếu, cùng transaction với việc ghi sổ.
   */
  private async fillMissingItemCodes(
    manager: EntityManager,
    lines: GarageGoodsReceiptLine[],
  ): Promise<void> {
    const missing = lines.filter((line) => !line.itemCode?.trim());
    if (missing.length === 0) return;
    const resolved = await this.itemResolver.resolveLines(manager, missing);
    missing.forEach((line, index) => {
      line.itemCode = resolved[index].itemCode ?? line.itemCode;
    });
    await manager.save(GarageGoodsReceiptLine, missing);
  }

  async cancelReceipt(receiptId: string): Promise<GarageGoodsReceipt> {
    return this.runInTransaction(async (manager, emit) => {
      const receipt = await this.lockReceipt(manager, receiptId);
      this.voucherEngine.validateVoucherTransition(receipt.status, 'cancel');
      if (receipt.status === 'POSTED') {
        const lines = await this.loadLines(manager, receipt.id);
        await assertGoodsUnused(manager, receipt, lines);
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
