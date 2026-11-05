import { ConflictException, NotFoundException } from '@nestjs/common';
import {
  DataSource,
  DeepPartial,
  EntityManager,
  EntityTarget,
  FindOptionsWhere,
} from 'typeorm';
import { requireReason } from '../../approval/approval.engine';
import {
  PROCUREMENT_FULFILLMENT_STATUS,
  PROCUREMENT_ORDER_STATUS,
  ProcurementOrderStatus,
} from '../contracts/procurement-orders.contract';
import { BaseProcurementOrderEntity } from '../entities/base-procurement-order.entity';
import { BaseProcurementOrderLineEntity } from '../entities/base-procurement-order-line.entity';
import { BaseProcurementOrderAcceptanceEntity } from '../entities/base-procurement-order-acceptance.entity';
import { fulfillmentStatusOf } from './procurement-order-engine.service';

export interface FulfilmentItem {
  orderLineId: string;
  qty: number;
  note?: string | null;
}

const toQty = (n: number): string => String(Math.round(n * 1000) / 1000);

/**
 * Giao nhận đơn mua. Hai đường tách hẳn nhau:
 * - applyGoodsReceipt: chỉ dòng GOODS, được gọi từ phiếu nhập kho.
 * - accept / voidAcceptance: chỉ dòng SERVICE, qua biên bản nghiệm thu.
 * Mọi thao tác khóa header trước, ghi số lượng và tính lại trạng thái trong cùng transaction.
 */
export abstract class AbstractProcurementOrderFulfilmentService<
  H extends BaseProcurementOrderEntity = BaseProcurementOrderEntity,
  L extends BaseProcurementOrderLineEntity = BaseProcurementOrderLineEntity,
  A extends BaseProcurementOrderAcceptanceEntity =
    BaseProcurementOrderAcceptanceEntity,
> {
  protected abstract readonly headerEntity: EntityTarget<H>;
  protected abstract readonly lineEntity: EntityTarget<L>;
  protected abstract readonly acceptanceEntity: EntityTarget<A>;
  protected abstract readonly lineForeignKey: keyof L & string;

  constructor(protected readonly dataSource: DataSource) {}

  /** Nhận hàng GOODS vào kho. Từ chối dòng SERVICE và vượt số đặt. */
  async applyGoodsReceipt(
    manager: EntityManager,
    orderId: string,
    items: FulfilmentItem[],
  ): Promise<void> {
    const header = await this.lockHeader(manager, orderId);
    this.assertIssued(header.status as ProcurementOrderStatus);
    const lines = await this.lockLines(manager, orderId);

    for (const item of items) {
      const line = this.findLine(lines, item.orderLineId);
      if (line.lineType !== 'GOODS') {
        throw new ConflictException(
          'Dòng dịch vụ không nhập kho, hãy nghiệm thu',
        );
      }
      this.addFulfilled(line, item.qty);
    }
    await manager.save(this.lineEntity, lines);
    await this.refreshHeader(manager, header, lines);
  }

  /**
   * Hoàn số lượng GOODS đã nhận (khi hủy phiếu nhập đã post). Chỉ khi đơn còn ISSUED,
   * hoặc đã tự đóng do đủ hàng (closeReason = null). Không hoàn quá số đã nhận.
   */
  async revertGoodsReceipt(
    manager: EntityManager,
    orderId: string,
    items: FulfilmentItem[],
  ): Promise<void> {
    const header = await this.lockHeader(manager, orderId);
    this.assertReversible(header);
    const lines = await this.lockLines(manager, orderId);

    for (const item of items) {
      const line = this.findLine(lines, item.orderLineId);
      if (line.lineType !== 'GOODS') {
        throw new ConflictException('Dòng dịch vụ không có phiếu nhập kho');
      }
      const next = Number(line.qtyFulfilled) - item.qty;
      if (!(item.qty > 0) || next < -1e-9) {
        throw new ConflictException(
          `Không hoàn ${item.qty} được, dòng mới nhận ${Number(line.qtyFulfilled)}`,
        );
      }
      line.qtyFulfilled = toQty(Math.max(0, next));
    }
    await manager.save(this.lineEntity, lines);
    await this.refreshHeader(manager, header, lines);
  }

  /** Nghiệm thu dịch vụ. Từ chối dòng GOODS và vượt phần còn lại. */
  async accept(
    manager: EntityManager,
    orderId: string,
    actorId: string,
    items: FulfilmentItem[],
  ): Promise<void> {
    const header = await this.lockHeader(manager, orderId);
    this.assertIssued(header.status as ProcurementOrderStatus);
    const lines = await this.lockLines(manager, orderId);
    const now = new Date();

    const rows: DeepPartial<A>[] = [];
    for (const item of items) {
      const line = this.findLine(lines, item.orderLineId);
      if (line.lineType !== 'SERVICE') {
        throw new ConflictException(
          'Dòng hàng hóa nhập qua phiếu nhập kho, không nghiệm thu',
        );
      }
      this.addFulfilled(line, item.qty);
      rows.push({
        [this.acceptanceForeignKey()]: orderId,
        orderLineId: line.id,
        qty: toQty(item.qty),
        acceptedBy: actorId,
        acceptedAt: now,
        note: item.note ?? null,
        isVoided: false,
      } as DeepPartial<A>);
    }
    await manager.save(this.lineEntity, lines);
    await manager.save(
      this.acceptanceEntity,
      manager.create(this.acceptanceEntity, rows),
    );
    await this.refreshHeader(manager, header, lines);
  }

  /** Hủy biên bản nghiệm thu: không xóa, đánh dấu và trừ lại số lượng. Bắt buộc lý do. */
  async voidAcceptance(
    manager: EntityManager,
    orderId: string,
    acceptanceId: string,
    actorId: string,
    reason: string | undefined,
  ): Promise<void> {
    const cleanReason = requireReason(reason);
    const header = await this.lockHeader(manager, orderId);
    const lines = await this.lockLines(manager, orderId);

    const acc = await manager.findOne(this.acceptanceEntity, {
      where: { id: acceptanceId, isVoided: false } as FindOptionsWhere<A>,
      lock: { mode: 'pessimistic_write' },
    });
    if (!acc || acc.orderId !== orderId) {
      throw new NotFoundException(
        'Không tìm thấy biên bản nghiệm thu còn hiệu lực',
      );
    }
    const line = this.findLine(lines, acc.orderLineId);
    line.qtyFulfilled = toQty(
      Math.max(0, Number(line.qtyFulfilled) - Number(acc.qty)),
    );

    acc.isVoided = true;
    acc.voidedBy = actorId;
    acc.voidedAt = new Date();
    acc.voidReason = cleanReason;
    await manager.save(this.acceptanceEntity, acc);
    await manager.save(this.lineEntity, lines);
    await this.refreshHeader(manager, header, lines);
  }

  protected abstract acceptanceForeignKey(): string;

  protected async lockHeader(manager: EntityManager, id: string): Promise<H> {
    const header = await manager.findOne(this.headerEntity, {
      where: { id, isDeleted: false } as FindOptionsWhere<H>,
      lock: { mode: 'pessimistic_write' },
    });
    if (!header) throw new NotFoundException('Không tìm thấy đơn mua');
    return header;
  }

  protected async lockLines(
    manager: EntityManager,
    orderId: string,
  ): Promise<L[]> {
    return manager.find(this.lineEntity, {
      where: { [this.lineForeignKey]: orderId } as FindOptionsWhere<L>,
      lock: { mode: 'pessimistic_write' },
    });
  }

  private assertReversible(header: H): void {
    const autoClosed =
      header.status === PROCUREMENT_ORDER_STATUS.CLOSED &&
      header.closeReason === null;
    if (header.status !== PROCUREMENT_ORDER_STATUS.ISSUED && !autoClosed) {
      throw new ConflictException(
        `Không hoàn nhận hàng khi đơn đang ở trạng thái ${header.status}`,
      );
    }
  }

  private assertIssued(status: ProcurementOrderStatus): void {
    if (status !== PROCUREMENT_ORDER_STATUS.ISSUED) {
      throw new ConflictException(
        `Chỉ giao nhận được khi đơn đã phát hành, hiện tại là ${status}`,
      );
    }
  }

  private findLine(lines: L[], lineId: string): L {
    const line = lines.find((l) => l.id === lineId);
    if (!line)
      throw new NotFoundException('Dòng đơn mua không thuộc chứng từ này');
    return line;
  }

  private addFulfilled(line: L, qty: number): void {
    const next = Number(line.qtyFulfilled) + qty;
    if (!(qty > 0) || next > Number(line.qtyOrdered) + 1e-9) {
      throw new ConflictException(
        `Số lượng ${qty} vượt phần còn lại ${Number(line.qtyOrdered) - Number(line.qtyFulfilled)}`,
      );
    }
    line.qtyFulfilled = toQty(next);
  }

  /** Đủ số lượng thì tự đóng (closeReason = null). Khi hủy nghiệm thu mà chưa đủ thì mở lại. */
  private async refreshHeader(
    manager: EntityManager,
    header: H,
    lines: L[],
  ): Promise<void> {
    const status = fulfillmentStatusOf(
      lines.map((l) => ({
        qtyOrdered: Number(l.qtyOrdered),
        qtyFulfilled: Number(l.qtyFulfilled),
      })),
    );
    header.fulfillmentStatus = status;

    if (
      status === PROCUREMENT_FULFILLMENT_STATUS.FULL &&
      header.status === PROCUREMENT_ORDER_STATUS.ISSUED
    ) {
      header.status = PROCUREMENT_ORDER_STATUS.CLOSED;
      header.closedAt = new Date();
      header.closeReason = null;
    } else if (
      status !== PROCUREMENT_FULFILLMENT_STATUS.FULL &&
      header.status === PROCUREMENT_ORDER_STATUS.CLOSED &&
      header.closeReason === null
    ) {
      header.status = PROCUREMENT_ORDER_STATUS.ISSUED;
      header.closedAt = null;
    }
    await manager.save(this.headerEntity, header);
  }
}
