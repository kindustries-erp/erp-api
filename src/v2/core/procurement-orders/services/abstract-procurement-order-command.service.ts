import { NotFoundException } from '@nestjs/common';
import {
  DataSource,
  DeepPartial,
  EntityManager,
  EntityTarget,
  FindOptionsWhere,
} from 'typeorm';
import { nextDocumentNo } from '../../../../common/numbering/document-numbering';
import { ApprovalEventService } from '../../approval/approval-event.service';
import {
  assertNotSelfApproval,
  requireReason,
  resolveTransition,
} from '../../approval/approval.engine';
import {
  PROCUREMENT_ORDER_ACTIONS_REQUIRING_APPROVER,
  PROCUREMENT_ORDER_ACTIONS_REQUIRING_REASON,
  PROCUREMENT_ORDER_TRANSITIONS,
  ProcurementOrderAction,
  ProcurementOrderStatus,
} from '../contracts/procurement-orders.contract';
import { BaseProcurementOrderEntity } from '../entities/base-procurement-order.entity';
import { BaseProcurementOrderLineEntity } from '../entities/base-procurement-order-line.entity';
import {
  assertCanCancel,
  assertEditable,
  assertReadyToSubmit,
  assertValidOrderLines,
  OrderDraftLineInput,
  orderTotalOf,
  OrderLineQty,
} from './procurement-order-engine.service';
import { RequestLinkPort } from './request-link.port';

export interface OrderDraftHeaderInput {
  orderDate: string;
  expectedDate?: string | null;
  supplierId?: string | null;
  supplierName?: string | null;
  remarks?: string | null;
  requestId?: string | null;
}

export interface OrderDraftLineFields {
  itemId?: string | null;
  itemCode?: string | null;
  itemName?: string | null;
  description?: string | null;
}

/** Các trường đầu đơn được phép sửa khi DRAFT (không gồm requestId, status, số phiếu). */
export type OrderHeaderPatch = Partial<
  Pick<
    OrderDraftHeaderInput,
    'orderDate' | 'expectedDate' | 'supplierId' | 'supplierName' | 'remarks'
  >
>;

export interface OrderActor {
  id: string;
  roles: string[];
}

/**
 * Command trừu tượng cho đơn mua. Mọi chuyển trạng thái chạy trong một transaction:
 * khóa header trước, kiểm tra điều kiện, cập nhật, rồi ghi nhật ký cùng lúc.
 * Khi hủy đơn có liên kết PR, số lượng được trả lại qua RequestLinkPort.
 */
export abstract class AbstractProcurementOrderCommandService<
  H extends BaseProcurementOrderEntity = BaseProcurementOrderEntity,
  L extends BaseProcurementOrderLineEntity = BaseProcurementOrderLineEntity,
> {
  protected abstract readonly headerEntity: EntityTarget<H>;
  protected abstract readonly lineEntity: EntityTarget<L>;
  protected abstract readonly lineForeignKey: keyof L & string;
  protected abstract readonly docType: string;
  /** Tiền tố số phiếu, ví dụ DMH (thường) hoặc GDMH (Garage). */
  protected abstract readonly numberPrefix: string;

  constructor(
    protected readonly dataSource: DataSource,
    protected readonly events: ApprovalEventService,
    protected readonly requestLink: RequestLinkPort,
  ) {}

  async transition(
    id: string,
    action: ProcurementOrderAction,
    actor: OrderActor,
    reason?: string,
  ): Promise<H> {
    return this.dataSource.transaction(async (manager) => {
      const header = await this.lockHeader(manager, id);
      const from = header.status as ProcurementOrderStatus;
      const lines = await this.loadLines(manager, id);

      if (PROCUREMENT_ORDER_ACTIONS_REQUIRING_APPROVER.includes(action)) {
        assertNotSelfApproval(actor.id, header.createdBy);
      }
      const cleanReason = PROCUREMENT_ORDER_ACTIONS_REQUIRING_REASON.includes(
        action,
      )
        ? requireReason(reason)
        : null;

      if (action === 'submit') {
        assertReadyToSubmit(
          header.supplierId,
          lines.map((l) => ({ unitPrice: l.unitPrice })),
        );
      }
      if (action === 'cancel') {
        assertCanCancel(lines.map((l) => this.toQty(l)));
      }

      const to = resolveTransition(PROCUREMENT_ORDER_TRANSITIONS, from, action);
      this.applyFields(header, action, actor.id, cleanReason);
      header.status = to;
      await manager.save(this.headerEntity, header);

      if (action === 'cancel' && header.requestId) {
        await this.requestLink.release(
          manager,
          header.requestId,
          lines
            .map((l) => ({
              requestLineId: l.requestLineId as string,
              qty: Number(l.qtyOrdered),
            }))
            .filter((i) => i.requestLineId),
        );
      }

      await this.events.record(manager, {
        docType: this.docType,
        docId: id,
        action,
        fromStatus: from,
        toStatus: to,
        actorId: actor.id,
        actorRoles: actor.roles,
        comment: cleanReason,
      });
      return header;
    });
  }

  /**
   * Tạo đơn nháp. Nếu có PR nguồn thì giữ số lượng trên PR trong cùng transaction,
   * cổng sẽ từ chối nếu vượt phần còn lại hoặc khác họ.
   */
  async createDraft(
    actor: OrderActor,
    input: OrderDraftHeaderInput,
    lines: Array<OrderDraftLineInput & OrderDraftLineFields>,
  ): Promise<H> {
    assertValidOrderLines(lines, input.requestId ?? null);
    return this.dataSource.transaction(async (manager) => {
      const orderNo = await nextDocumentNo(
        manager,
        this.headerEntity,
        'orderNo' as keyof H & string,
        this.numberPrefix,
        input.orderDate,
      );
      const header = await manager.save(
        this.headerEntity,
        manager.create(this.headerEntity, {
          ...input,
          orderNo,
          sourceType: input.requestId ? 'REQUEST' : 'DIRECT',
          status: 'DRAFT',
          fulfillmentStatus: 'NONE',
          totalAmount: String(orderTotalOf(lines)),
          createdBy: actor.id,
          isDeleted: false,
        } as DeepPartial<H>),
      );
      await this.writeLines(manager, header, lines);
      if (input.requestId) {
        await this.requestLink.reserve(
          manager,
          input.requestId,
          this.toRequestItems(lines),
        );
      }
      return header;
    });
  }

  /** Thay dòng khi còn DRAFT: trả số cũ về PR, rồi giữ số mới. */
  async replaceDraftLines(
    id: string,
    lines: Array<OrderDraftLineInput & OrderDraftLineFields>,
  ): Promise<H> {
    return this.dataSource.transaction(async (manager) => {
      const header = await this.lockHeader(manager, id);
      assertEditable(header.status as ProcurementOrderStatus);
      assertValidOrderLines(lines, header.requestId);

      const oldLines = await this.loadLines(manager, id);
      if (header.requestId) {
        await this.requestLink.release(
          manager,
          header.requestId,
          this.toRequestItems(oldLines.map((l) => this.asInput(l))),
        );
      }
      await manager.delete(this.lineEntity, {
        [this.lineForeignKey]: id,
      } as never);
      await this.writeLines(manager, header, lines);
      header.totalAmount = String(orderTotalOf(lines));
      await manager.save(this.headerEntity, header);
      if (header.requestId) {
        await this.requestLink.reserve(
          manager,
          header.requestId,
          this.toRequestItems(lines),
        );
      }
      return header;
    });
  }

  /** Sửa thông tin đầu đơn khi còn DRAFT. Chỉ các trường được truyền mới bị ghi đè. */
  async updateHeader<P extends OrderHeaderPatch>(
    id: string,
    patch: P,
  ): Promise<H> {
    return this.dataSource.transaction(async (manager) => {
      const header = await this.lockHeader(manager, id);
      assertEditable(header.status as ProcurementOrderStatus);
      const changes = Object.fromEntries(
        Object.entries(patch).filter(([, value]) => value !== undefined),
      );
      Object.assign(header, changes);
      return manager.save(this.headerEntity, header);
    });
  }

  /**
   * Xóa mềm đơn nháp và trả số lượng đã giữ trên PR nguồn (nếu có) trong cùng transaction.
   * Chỉ áp dụng cho DRAFT; đơn đã duyệt phải hủy qua transition 'cancel'.
   */
  async softDeleteDraft(id: string): Promise<H> {
    return this.dataSource.transaction(async (manager) => {
      const header = await this.lockHeader(manager, id);
      assertEditable(header.status as ProcurementOrderStatus);
      await this.releaseHeldQty(manager, header);
      header.isDeleted = true;
      return manager.save(this.headerEntity, header);
    });
  }

  /**
   * Xóa cứng đơn nháp cùng dòng, sau khi trả số lượng đã giữ trên PR nguồn.
   * Chặn khi còn chứng từ phụ thuộc (lớp con kiểm qua assertNoDependentReceipts).
   */
  async hardDeleteDraft(id: string): Promise<void> {
    return this.dataSource.transaction(async (manager) => {
      const header = await this.lockHeader(manager, id);
      assertEditable(header.status as ProcurementOrderStatus);
      await this.assertNoDependentReceipts(manager, id);
      await this.releaseHeldQty(manager, header);
      await manager.delete(this.lineEntity, {
        [this.lineForeignKey]: id,
      } as never);
      await manager.delete(this.headerEntity, id);
    });
  }

  /**
   * Chặn xóa cứng khi có chứng từ nhận hàng tham chiếu. Lớp con ghi đè bằng entity phiếu nhập của mình.
   * Lớp cơ sở không biết entity phiếu nhập nên không kiểm gì.
   */
  protected async assertNoDependentReceipts(
    manager: EntityManager,
    id: string,
  ): Promise<void> {
    await Promise.resolve([manager, id]);
  }

  /** Trả số lượng đã giữ trên PR nguồn về PR, nếu đơn có liên kết. */
  private async releaseHeldQty(
    manager: EntityManager,
    header: H,
  ): Promise<void> {
    if (!header.requestId) return;
    const lines = await this.loadLines(manager, header.id);
    await this.requestLink.release(
      manager,
      header.requestId,
      this.toRequestItems(lines.map((l) => this.asInput(l))),
    );
  }

  private async writeLines(
    manager: EntityManager,
    header: H,
    lines: Array<OrderDraftLineInput & OrderDraftLineFields>,
  ): Promise<void> {
    const rows = lines.map((l, i) => {
      const amount =
        l.unitPrice == null
          ? null
          : String(Math.round(l.qtyOrdered * l.unitPrice * 1000) / 1000);
      return manager.create(this.lineEntity, {
        ...l,
        lineNo: i + 1,
        [this.lineForeignKey]: header.id,
        qtyOrdered: String(l.qtyOrdered),
        qtyFulfilled: '0',
        unitPrice: l.unitPrice == null ? null : String(l.unitPrice),
        amount,
        requestLineId: l.requestLineId ?? null,
      } as DeepPartial<L>);
    });
    await manager.save(this.lineEntity, rows);
  }

  private toRequestItems(
    lines: Array<{
      requestLineId?: string | null;
      qtyOrdered: number | string;
      lineType: string;
    }>,
  ): Array<{
    requestLineId: string;
    qty: number;
    lineType: 'GOODS' | 'SERVICE';
  }> {
    return lines
      .filter(
        (l): l is typeof l & { requestLineId: string } => !!l.requestLineId,
      )
      .map((l) => ({
        requestLineId: l.requestLineId,
        qty: Number(l.qtyOrdered),
        lineType: l.lineType as 'GOODS' | 'SERVICE',
      }));
  }

  private asInput(l: L): OrderDraftLineInput {
    return {
      lineType: l.lineType,
      qtyOrdered: Number(l.qtyOrdered),
      unitPrice: l.unitPrice == null ? null : Number(l.unitPrice),
      requestLineId: l.requestLineId,
    };
  }

  protected async lockHeader(manager: EntityManager, id: string): Promise<H> {
    const header = await manager.findOne(this.headerEntity, {
      where: { id, isDeleted: false } as FindOptionsWhere<H>,
      lock: { mode: 'pessimistic_write' },
    });
    if (!header) throw new NotFoundException('Không tìm thấy đơn mua');
    return header;
  }

  protected async loadLines(manager: EntityManager, id: string): Promise<L[]> {
    return manager.find(this.lineEntity, {
      where: { [this.lineForeignKey]: id } as FindOptionsWhere<L>,
    });
  }

  protected toQty(line: L): OrderLineQty {
    return {
      qtyOrdered: Number(line.qtyOrdered),
      qtyFulfilled: Number(line.qtyFulfilled),
    };
  }

  /** Ghi cột duyệt theo hành động. approve chốt tổng tiền đã duyệt. */
  protected applyFields(
    header: H,
    action: ProcurementOrderAction,
    actorId: string,
    reason: string | null,
  ): void {
    const now = new Date();
    switch (action) {
      case 'submit':
        header.submittedBy = actorId;
        header.submittedAt = now;
        break;
      case 'approve':
        header.approvedBy = actorId;
        header.approvedAt = now;
        header.approvedTotal = header.totalAmount;
        break;
      case 'reject':
        header.rejectedBy = actorId;
        header.rejectedAt = now;
        header.rejectReason = reason;
        break;
      case 'issue':
        header.issuedBy = actorId;
        header.issuedAt = now;
        break;
      case 'cancel':
        header.cancelledBy = actorId;
        header.cancelledAt = now;
        header.cancelReason = reason;
        break;
      case 'close':
        header.closedAt = now;
        header.closeReason = reason;
        break;
      case 'recall':
        break;
    }
  }
}
