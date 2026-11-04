import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import {
  DataSource,
  DeepPartial,
  EntityManager,
  EntityTarget,
  FindOptionsOrder,
  FindOptionsWhere,
} from 'typeorm';
import type { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import {
  PURCHASE_ORDER_STATUS,
  PurchaseOrderAction,
  PurchaseOrderStatus,
} from '../contracts/purchase-order.contract';
import type { BasePurchaseOrderEntity } from '../entities/base-purchase-order.entity';
import type { BasePurchaseOrderLineEntity } from '../entities/base-purchase-order-line.entity';
import {
  BaseCreatePurchaseOrderLineDto,
  BaseCreatePurchaseOrderDto,
  BaseUpdatePurchaseOrderDto,
} from '../dto';
import {
  NormalizedPurchaseOrderLine,
  PurchaseOrderEngine,
} from './purchase-order-engine.service';
import { PurchaseOrderNumberingService } from './purchase-order-numbering.service';

/** Khai báo bảng của module con: header, dòng, và tên thuộc tính FK trên dòng. */
export interface PurchaseOrderEntityTarget<
  H extends BasePurchaseOrderEntity,
  L extends BasePurchaseOrderLineEntity,
> {
  header: EntityTarget<H>;
  line: EntityTarget<L>;
  /** Thuộc tính trỏ về header trên entity dòng, ví dụ 'purchaseOrderId'. */
  lineForeignKey: string;
}

interface NormalizedInput {
  input: BaseCreatePurchaseOrderLineDto;
  fields: NormalizedPurchaseOrderLine;
}

/**
 * Lệnh ghi PO dùng chung (template method). Module con chỉ khai báo bảng,
 * tiền tố số và hook. Luật trạng thái, khóa, và kiểm tra dòng nằm ở đây
 * và ở engine, không nằm trong module con.
 *
 * Mọi thao tác ghi chạy trong một transaction. Header bị khóa
 * (pessimistic_write) trước khi đổi dòng hoặc trạng thái, nên GR đồng thời
 * phải khóa header theo cùng cách (qua applyReceiptProgress).
 */
export abstract class AbstractPurchaseOrderCommandService<
  H extends BasePurchaseOrderEntity,
  L extends BasePurchaseOrderLineEntity,
> {
  protected abstract readonly target: PurchaseOrderEntityTarget<H, L>;
  /** Tiền tố số chứng từ, ví dụ 'PO' hoặc 'GPO'. */
  protected abstract readonly numberPrefix: string;

  constructor(
    protected readonly dataSource: DataSource,
    protected readonly engine: PurchaseOrderEngine,
    protected readonly numbering: PurchaseOrderNumberingService,
  ) {}

  // ----- Hook mở rộng (mặc định không làm gì) -----

  /** Ném lỗi nếu hủy không được phép (ví dụ đã có phiếu nhập liên kết). */
  protected assertCanCancel(_header: H): Promise<void> {
    return Promise.resolve();
  }

  /** Cột riêng của module con (ví dụ branchId, totalAmount) gộp vào header. */
  protected extraHeaderFields(
    _dto: BaseUpdatePurchaseOrderDto,
  ): Record<string, unknown> {
    return {};
  }

  /** Chạy sau khi dòng được ghi, trong cùng transaction (ví dụ tính tổng). */
  protected onLinesPersisted(
    _manager: EntityManager,
    _header: H,
    _lines: L[],
  ): Promise<void> {
    return Promise.resolve();
  }

  // ----- Lệnh công khai -----

  /** Tạo PO ở trạng thái DRAFT. userId lấy từ JWT, không nhận từ body (#4). */
  async create(
    dto: BaseCreatePurchaseOrderDto,
    userId: string | null,
  ): Promise<{ id: string; poNo: string }> {
    const normalized = this.normalizeInputs(dto.lines ?? []);
    return this.dataSource.transaction(async (manager) => {
      const poNo = await this.resolvePoNo(manager, dto.poNo, dto.orderDate);
      const created = manager.create(this.target.header, {
        ...this.headerFields(dto),
        ...this.extraHeaderFields(dto),
        poNo,
        status: PURCHASE_ORDER_STATUS.DRAFT,
        isDeleted: false,
        createdBy: userId,
      } as DeepPartial<H>);
      const header = await manager.save(created);

      if (normalized.length > 0) {
        await manager.save(
          this.target.line,
          normalized.map(({ input, fields }, index) =>
            this.lineRecord(header.id, index + 1, input, fields, '0'),
          ),
        );
      }
      await this.onLinesPersisted(
        manager,
        header,
        await this.loadLines(manager, header.id),
      );
      return { id: header.id, poNo };
    });
  }

  /** Sửa header và/hoặc dòng. Không nhận status (đổi qua approve/confirm/cancel). */
  async update(
    id: string,
    dto: BaseUpdatePurchaseOrderDto,
  ): Promise<{ id: string }> {
    const normalized =
      dto.lines === undefined ? undefined : this.normalizeInputs(dto.lines);
    return this.dataSource.transaction(async (manager) => {
      const header = await this.lockHeader(manager, id);
      this.engine.assertHeaderEditable(header.status);

      const changes: Record<string, unknown> = {
        ...this.headerFields(dto),
        ...this.extraHeaderFields(dto),
      };
      if (dto.poNo && dto.poNo !== header.poNo) {
        await this.assertPoNoFree(manager, dto.poNo);
        changes.poNo = dto.poNo;
      }
      if (Object.keys(changes).length > 0) {
        await manager.update(
          this.target.header,
          { id } as FindOptionsWhere<H>,
          changes as QueryDeepPartialEntity<H>,
        );
      }
      if (normalized) {
        await this.replaceLines(manager, id, normalized);
      }
      await this.onLinesPersisted(
        manager,
        header,
        await this.loadLines(manager, id),
      );
      return { id };
    });
  }

  approve(id: string) {
    return this.transition(id, 'approve');
  }

  confirm(id: string) {
    return this.transition(id, 'confirm');
  }

  cancel(id: string) {
    return this.transition(id, 'cancel');
  }

  /** Xóa mềm, chỉ khi còn DRAFT (đã duyệt thì phải hủy). */
  async softDelete(id: string): Promise<{ id: string }> {
    return this.dataSource.transaction(async (manager) => {
      const header = await this.lockHeader(manager, id);
      if (header.status !== PURCHASE_ORDER_STATUS.DRAFT) {
        throw new BadRequestException(
          'Chỉ xóa được đơn mua hàng ở trạng thái nháp, đơn đã duyệt hãy hủy',
        );
      }
      await manager.update(
        this.target.header,
        { id } as FindOptionsWhere<H>,
        { isDeleted: true } as unknown as QueryDeepPartialEntity<H>,
      );
      return { id };
    });
  }

  /**
   * Cập nhật số đã nhận theo dòng (giá trị tuyệt đối) và đổi trạng thái theo
   * engine. Phục vụ luồng phiếu nhập; gọi trong transaction của phiếu nhập.
   */
  async applyReceiptProgress(
    manager: EntityManager,
    headerId: string,
    receivedByLineId: Record<string, number>,
  ): Promise<PurchaseOrderStatus> {
    const header = await this.lockHeader(manager, headerId);
    if (
      header.status === PURCHASE_ORDER_STATUS.DRAFT ||
      header.status === PURCHASE_ORDER_STATUS.CANCELLED
    ) {
      throw new BadRequestException(
        `Không ghi nhận nhận hàng khi phiếu đang ở trạng thái ${header.status}`,
      );
    }
    const lines = await this.loadLines(manager, headerId);
    let totalOrdered = 0;
    let totalReceived = 0;
    for (const line of lines) {
      const ordered = Number(line.qtyOrdered);
      const received =
        line.id in receivedByLineId
          ? receivedByLineId[line.id]
          : Number(line.qtyReceived);
      if (!Number.isFinite(received) || received < 0 || received > ordered) {
        throw new BadRequestException(
          `Số đã nhận không hợp lệ ở dòng ${line.lineNo} (đặt ${ordered})`,
        );
      }
      if (line.id in receivedByLineId) {
        await manager.update(
          this.target.line,
          { id: line.id } as FindOptionsWhere<L>,
          {
            qtyReceived: received.toFixed(3),
          } as unknown as QueryDeepPartialEntity<L>,
        );
      }
      totalOrdered += ordered;
      totalReceived += received;
    }
    const status = this.engine.statusAfterReceipt(
      header.status,
      totalOrdered,
      totalReceived,
    );
    if (status !== header.status) {
      await manager.update(
        this.target.header,
        { id: headerId } as FindOptionsWhere<H>,
        { status } as unknown as QueryDeepPartialEntity<H>,
      );
    }
    return status;
  }

  // ----- Nội bộ -----

  private async transition(id: string, action: PurchaseOrderAction) {
    return this.dataSource.transaction(async (manager) => {
      const header = await this.lockHeader(manager, id);
      this.engine.assertAction(action, header.status);
      if (action === 'cancel') {
        await this.assertCanCancel(header);
      }
      const status = this.engine.targetOf(action);
      await manager.update(
        this.target.header,
        { id } as FindOptionsWhere<H>,
        { status } as unknown as QueryDeepPartialEntity<H>,
      );
      return { id, status };
    });
  }

  protected async lockHeader(manager: EntityManager, id: string): Promise<H> {
    const header = await manager.findOne(this.target.header, {
      where: { id, isDeleted: false } as FindOptionsWhere<H>,
      lock: { mode: 'pessimistic_write' },
    });
    if (!header) {
      throw new NotFoundException('Không tìm thấy đơn mua hàng');
    }
    return header;
  }

  protected loadLines(manager: EntityManager, headerId: string): Promise<L[]> {
    return manager.find(this.target.line, {
      where: {
        [this.target.lineForeignKey]: headerId,
      } as FindOptionsWhere<L>,
      order: { lineNo: 'ASC' } as FindOptionsOrder<L>,
    });
  }

  private normalizeInputs(
    inputs: BaseCreatePurchaseOrderLineDto[],
  ): NormalizedInput[] {
    return inputs.map((input) => ({
      input,
      fields: this.engine.normalizeLine(input),
    }));
  }

  /** Số do client gửi thì phải chưa tồn tại; để trống thì sinh có khóa. */
  private async resolvePoNo(
    manager: EntityManager,
    requested: string | undefined,
    orderDate: string,
  ): Promise<string> {
    if (requested) {
      await this.assertPoNoFree(manager, requested);
      return requested;
    }
    return this.numbering.nextNo(
      manager,
      this.target.header,
      this.numberPrefix,
      orderDate,
    );
  }

  private async assertPoNoFree(
    manager: EntityManager,
    poNo: string,
  ): Promise<void> {
    const taken = await manager.exists(this.target.header, {
      where: { poNo } as FindOptionsWhere<H>,
    });
    if (taken) {
      throw new ConflictException(`Số đơn mua hàng ${poNo} đã tồn tại`);
    }
  }

  /**
   * Thay toàn bộ dòng theo thứ tự gửi lên. Dòng cũ khớp theo vị trí giữ
   * qtyReceived; dòng thừa bị xóa (engine đã chặn xóa dòng có số nhận).
   */
  private async replaceLines(
    manager: EntityManager,
    headerId: string,
    normalized: NormalizedInput[],
  ): Promise<void> {
    const current = await this.loadLines(manager, headerId);
    this.engine.assertLinesEditable(
      current,
      normalized.map((n) => n.fields),
    );

    const removedIds = current.slice(normalized.length).map((line) => line.id);
    if (removedIds.length > 0) {
      await manager.delete(this.target.line, removedIds);
    }
    if (normalized.length > 0) {
      await manager.save(
        this.target.line,
        normalized.map(({ input, fields }, index) => {
          const existing = current[index];
          return this.lineRecord(
            headerId,
            index + 1,
            input,
            fields,
            existing?.qtyReceived ?? '0',
            existing?.id,
          );
        }),
      );
    }
  }

  private lineRecord(
    headerId: string,
    lineNo: number,
    input: BaseCreatePurchaseOrderLineDto,
    fields: NormalizedPurchaseOrderLine,
    qtyReceived: string,
    id?: string,
  ): DeepPartial<L> {
    return {
      ...(id ? { id } : {}),
      lineNo,
      itemId: input.itemId ?? null,
      itemCode: input.itemCode ?? null,
      itemName: input.itemName ?? null,
      description: input.description ?? null,
      qtyOrdered: fields.qtyOrdered,
      unitPrice: fields.unitPrice,
      amount: fields.amount,
      qtyReceived,
      [this.target.lineForeignKey]: headerId,
    } as DeepPartial<L>;
  }

  /** Chỉ gồm các trường client gửi (undefined thì bỏ qua). */
  private headerFields(
    dto: BaseUpdatePurchaseOrderDto,
  ): Record<string, unknown> {
    const fields: Record<string, unknown> = {};
    if (dto.supplierId !== undefined)
      fields.supplierId = dto.supplierId ?? null;
    if (dto.orderDate !== undefined) fields.orderDate = new Date(dto.orderDate);
    if (dto.expectedDate !== undefined) {
      fields.expectedDate = dto.expectedDate
        ? new Date(dto.expectedDate)
        : null;
    }
    if (dto.remarks !== undefined) fields.remarks = dto.remarks ?? null;
    if (dto.supplierInvoiceNo !== undefined) {
      fields.supplierInvoiceNo = dto.supplierInvoiceNo ?? null;
    }
    return fields;
  }
}
