import { ConflictException, NotFoundException } from '@nestjs/common';
import { EntityManager, EntityTarget, FindOptionsWhere } from 'typeorm';
import { BasePurchaseRequestEntity } from '../entities/base-purchase-request.entity';
import { BasePurchaseRequestLineEntity } from '../entities/base-purchase-request-line.entity';
import {
  PURCHASE_REQUEST_STATUS,
  PurchaseRequestStatus,
} from '../contracts/procurement-requests.contract';
import {
  assertOrderable,
  orderingStatusOf,
} from './procurement-request-engine.service';

export interface OrderingItem {
  requestLineId: string;
  qty: number;
  lineType?: 'GOODS' | 'SERVICE';
}

/** Số lượng lưu cột numeric(18,3): làm tròn 3 chữ số. */
const toQty = (n: number): string => String(Math.round(n * 1000) / 1000);

/**
 * Cổng đặt hàng duy nhất để PO ghi vào PR. Chạy trong transaction của PO,
 * khóa header PR trước, rồi các dòng PR, rồi mới cập nhật số lượng.
 */
export abstract class AbstractPurchaseRequestOrderingService<
  H extends BasePurchaseRequestEntity = BasePurchaseRequestEntity,
  L extends BasePurchaseRequestLineEntity = BasePurchaseRequestLineEntity,
> {
  protected abstract readonly headerEntity: EntityTarget<H>;
  protected abstract readonly lineEntity: EntityTarget<L>;
  protected abstract readonly lineForeignKey: keyof L & string;

  /** Cộng số lượng đã đặt cho các dòng. Kiểm tra không vượt phần còn lại. */
  async reserve(
    manager: EntityManager,
    requestId: string,
    items: OrderingItem[],
  ): Promise<void> {
    const header = await this.lockHeader(manager, requestId);
    const lines = await this.lockLines(manager, requestId);

    for (const item of items) {
      const line = this.findLine(lines, item.requestLineId);
      if (item.lineType && item.lineType !== line.lineType) {
        throw new ConflictException(
          'Loại dòng đơn mua không khớp với dòng đề nghị',
        );
      }
      assertOrderable(
        header.status as PurchaseRequestStatus,
        {
          qtyRequested: Number(line.qtyRequested),
          qtyOrdered: Number(line.qtyOrdered),
        },
        item.qty,
      );
      line.qtyOrdered = toQty(Number(line.qtyOrdered) + item.qty);
    }
    await manager.save(this.lineEntity, lines);
    await this.refreshHeader(manager, header, lines, true);
  }

  /** Trả lại số lượng khi hủy PO hoặc xóa PO nháp. */
  async release(
    manager: EntityManager,
    requestId: string,
    items: OrderingItem[],
  ): Promise<void> {
    const header = await this.lockHeader(manager, requestId);
    const lines = await this.lockLines(manager, requestId);

    for (const item of items) {
      const line = this.findLine(lines, item.requestLineId);
      line.qtyOrdered = toQty(Math.max(0, Number(line.qtyOrdered) - item.qty));
    }
    await manager.save(this.lineEntity, lines);
    await this.refreshHeader(manager, header, lines, false);
  }

  protected async lockHeader(manager: EntityManager, id: string): Promise<H> {
    const header = await manager.findOne(this.headerEntity, {
      where: { id, isDeleted: false } as FindOptionsWhere<H>,
      lock: { mode: 'pessimistic_write' },
    });
    if (!header) throw new NotFoundException('Không tìm thấy đề nghị mua');
    return header;
  }

  protected async lockLines(
    manager: EntityManager,
    requestId: string,
  ): Promise<L[]> {
    return manager.find(this.lineEntity, {
      where: { [this.lineForeignKey]: requestId } as FindOptionsWhere<L>,
      lock: { mode: 'pessimistic_write' },
    });
  }

  private findLine(lines: L[], lineId: string): L {
    const line = lines.find((l) => l.id === lineId);
    if (!line)
      throw new NotFoundException('Dòng đề nghị không thuộc chứng từ này');
    return line;
  }

  /**
   * Tính lại tiến độ. Đủ số lượng thì tự đóng; khi trả lại số lượng thì mở lại,
   * nhưng chỉ mở lại nếu việc đóng là tự động (closeReason = null).
   */
  private async refreshHeader(
    manager: EntityManager,
    header: H,
    lines: L[],
    reserving: boolean,
  ): Promise<void> {
    const status = orderingStatusOf(
      lines.map((l) => ({
        qtyRequested: Number(l.qtyRequested),
        qtyOrdered: Number(l.qtyOrdered),
      })),
    );
    header.orderingStatus = status;

    if (
      reserving &&
      status === 'FULL' &&
      header.status === PURCHASE_REQUEST_STATUS.APPROVED
    ) {
      header.status = PURCHASE_REQUEST_STATUS.CLOSED;
      header.closedAt = new Date();
      header.closeReason = null;
    } else if (
      !reserving &&
      header.status === PURCHASE_REQUEST_STATUS.CLOSED &&
      header.closeReason === null &&
      status !== 'FULL'
    ) {
      header.status = PURCHASE_REQUEST_STATUS.APPROVED;
      header.closedAt = null;
    }
    await manager.save(this.headerEntity, header);
  }
}
