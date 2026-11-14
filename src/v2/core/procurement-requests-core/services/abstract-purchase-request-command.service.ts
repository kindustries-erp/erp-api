import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { nextDocumentNo } from '../../../../common/numbering/document-numbering';
import {
  DataSource,
  DeepPartial,
  EntityManager,
  EntityTarget,
  FindOptionsWhere,
} from 'typeorm';
import { runInOptionalTransaction } from '../../base-core/helpers/run-in-optional-transaction.util';
import { ApprovalEventService } from '../../approval-core/approval-event.service';
import {
  assertCanDecide,
  loadApprovalMode,
  resolveSubmitDecision,
} from '../../approval-core/approval-gate.helper';
import {
  assertNotSelfApproval,
  requireReason,
  resolveTransition,
} from '../../approval-core/approval.engine';
import {
  PURCHASE_REQUEST_ACTIONS_REQUIRING_APPROVER,
  PURCHASE_REQUEST_ACTIONS_REQUIRING_REASON,
  PURCHASE_REQUEST_TRANSITIONS,
  PurchaseRequestAction,
  PurchaseRequestStatus,
} from '../contracts/procurement-requests.contract';
import { BasePurchaseRequestEntity } from '../entities/base-purchase-request.entity';
import { BasePurchaseRequestLineEntity } from '../entities/base-purchase-request-line.entity';
import {
  assertCanCancel,
  assertLinesEditable,
  assertNoHeldQty,
  assertValidDraftLines,
  DraftLineInput,
  estimatedTotalOf,
  RequestLineQty,
} from './procurement-request-engine.service';
import {
  assertValidExtraData,
  ExtraData,
  mergeExtraData,
} from '../../base-core/helpers/extra-data.util';

/** Trạng thái được phép nhân bản: đã từ chối hoặc đã hủy. */
const CLONABLE_REQUEST_STATUSES: readonly PurchaseRequestStatus[] = [
  'REJECTED',
  'CANCELLED',
];

export interface DraftHeaderInput {
  /** Phiếu gốc khi nhân bản (null/undefined khi tạo mới). */
  clonedFromId?: string | null;
  requestDate: string;
  neededDate?: string | null;
  title?: string | null;
  requesterEmployeeId?: string | null;
  remarks?: string | null;
  /** Dữ liệu tùy biến. Khi tạo: mặc định `{}`. */
  extraData?: ExtraData;
}

/**
 * Các trường đầu đề sửa được khi nháp (không gồm chi nhánh, số phiếu, trạng thái).
 * `extraData` được merge cấp 1 với dữ liệu đang lưu, không thay thế toàn bộ.
 */
export type DraftHeaderPatch = Partial<
  Pick<
    DraftHeaderInput,
    'requestDate' | 'neededDate' | 'title' | 'remarks' | 'extraData'
  >
>;

export interface DraftLineFields {
  itemId?: string | null;
  itemCode?: string | null;
  itemName?: string | null;
  description?: string | null;
  notes?: string | null;
  extraData?: ExtraData;
}

export interface RequestActor {
  id: string;
  roles: string[];
}

/**
 * Command trừu tượng cho đề nghị mua. Module con khai báo entity, khóa ngoại dòng
 * và loại chứng từ. Mọi chuyển trạng thái chạy trong một transaction, khóa header
 * bằng pessimistic_write trước khi kiểm tra, và ghi nhật ký cùng transaction.
 */
export abstract class AbstractPurchaseRequestCommandService<
  H extends BasePurchaseRequestEntity = BasePurchaseRequestEntity,
  L extends BasePurchaseRequestLineEntity = BasePurchaseRequestLineEntity,
> {
  protected abstract readonly headerEntity: EntityTarget<H>;
  protected abstract readonly lineEntity: EntityTarget<L>;
  /** Tên thuộc tính khóa ngoại tới header trên entity dòng (ví dụ: requestId). */
  protected abstract readonly lineForeignKey: keyof L & string;
  protected abstract readonly docType: string;
  /** Tiền tố số phiếu, ví dụ DNM (thường) hoặc GDNM (Garage). */
  protected abstract readonly numberPrefix: string;

  constructor(
    protected readonly dataSource: DataSource,
    protected readonly events: ApprovalEventService,
  ) {}

  /**
   * Chuyển trạng thái. `approverId` chỉ dùng cho submit: người được chọn duyệt.
   * Khi khóa duyệt tắt, submit tự duyệt (APPROVED) và ghi nhật ký AUTO_APPROVED.
   */
  async transition(
    id: string,
    action: PurchaseRequestAction,
    actor: RequestActor,
    reason?: string,
    approverId?: string | null,
    outerManager?: EntityManager,
  ): Promise<H> {
    return runInOptionalTransaction(
      this.dataSource,
      outerManager,
      async (manager) => {
        const header = await this.lockHeader(manager, id);
        const from = header.status as PurchaseRequestStatus;
        const mode = await loadApprovalMode(manager, this.docType);

        if (
          action === 'submit' &&
          header.createdBy &&
          header.createdBy !== actor.id
        ) {
          throw new ForbiddenException('Chỉ người tạo mới được gửi duyệt');
        }
        if (
          action === 'recall' &&
          header.createdBy &&
          header.createdBy !== actor.id
        ) {
          throw new ForbiddenException('Chỉ người tạo mới được thu hồi');
        }
        if (PURCHASE_REQUEST_ACTIONS_REQUIRING_APPROVER.includes(action)) {
          assertNotSelfApproval(actor.id, header.createdBy);
          assertCanDecide(header.approverId, actor.id);
        }
        const cleanReason = PURCHASE_REQUEST_ACTIONS_REQUIRING_REASON.includes(
          action,
        )
          ? requireReason(reason)
          : null;
        if (action === 'cancel') {
          assertCanCancel(await this.loadLineQty(manager, id));
        }

        const to = resolveTransition(
          PURCHASE_REQUEST_TRANSITIONS,
          from,
          action,
        );
        const decision =
          action === 'submit'
            ? resolveSubmitDecision(mode, actor.id, approverId)
            : null;

        this.applyFields(header, action, actor.id, cleanReason);
        if (decision) {
          header.approverId = decision.approverId;
          if (decision.autoApprove) {
            this.applyFields(header, 'approve', actor.id, null);
          }
        }
        if (action === 'recall' || action === 'reject') {
          header.approverId = null;
        }
        const finalTo = decision?.autoApprove ? 'APPROVED' : to;
        header.status = finalTo;
        await manager.save(this.headerEntity, header);

        await this.events.record(manager, {
          docType: this.docType,
          docId: id,
          action: decision?.autoApprove ? 'AUTO_APPROVED' : action,
          fromStatus: from,
          toStatus: finalTo,
          actorId: actor.id,
          actorRoles: actor.roles,
          comment: cleanReason,
        });
        return header;
      },
    );
  }

  /**
   * Nhân bản đề nghị ĐÃ TỪ CHỐI hoặc ĐÃ HỦY thành nháp mới: số phiếu mới, người tạo là
   * người nhân bản, copy đầu đề và dòng hàng. Không copy duyệt/từ chối/hủy/đặt hàng.
   * `copyHeaderFields` là các trường riêng của họ con cần giữ (ví dụ chi nhánh).
   */
  async cloneDraft(
    sourceId: string,
    actor: RequestActor,
    copyHeaderFields: readonly string[] = [],
  ): Promise<H> {
    const source = (await this.dataSource.manager.findOne(this.headerEntity, {
      where: { id: sourceId } as unknown as FindOptionsWhere<H>,
    })) as H | null;
    if (!source) throw new NotFoundException('Không tìm thấy đề nghị');
    if (
      !CLONABLE_REQUEST_STATUSES.includes(
        source.status as PurchaseRequestStatus,
      )
    ) {
      throw new ConflictException(
        'Chỉ nhân bản đề nghị đã từ chối hoặc đã hủy',
      );
    }
    const sourceLines = (await this.dataSource.manager.find(this.lineEntity, {
      where: {
        [this.lineForeignKey]: sourceId,
      } as unknown as FindOptionsWhere<L>,
      order: { lineNo: 'ASC' } as never,
    })) as unknown as BasePurchaseRequestLineEntity[];

    const header: DraftHeaderInput & Record<string, unknown> = {
      requestDate: new Date().toISOString().slice(0, 10),
      neededDate: source.neededDate,
      title: source.title,
      requesterEmployeeId: source.requesterEmployeeId,
      remarks: source.remarks,
      extraData: {},
      clonedFromId: sourceId,
    };
    for (const field of copyHeaderFields) {
      header[field] = (source as unknown as Record<string, unknown>)[field];
    }
    const lines = sourceLines.map((l) => ({
      lineType: l.lineType,
      qtyRequested: Number(l.qtyRequested),
      estUnitPrice: l.estUnitPrice === null ? null : Number(l.estUnitPrice),
      itemId: l.itemId,
      itemCode: l.itemCode,
      itemName: l.itemName,
      description: l.description,
      notes: l.notes,
    }));
    return this.createDraft(actor, header, lines);
  }

  /** Tạo đề nghị ở trạng thái DRAFT, đánh số trong cùng transaction. */
  async createDraft(
    actor: RequestActor,
    input: DraftHeaderInput,
    lines: Array<DraftLineInput & DraftLineFields>,
    outerManager?: EntityManager,
  ): Promise<H> {
    assertValidDraftLines(lines);
    if (input.extraData !== undefined) assertValidExtraData(input.extraData);
    return runInOptionalTransaction(
      this.dataSource,
      outerManager,
      async (manager) => {
        const requestNo = await nextDocumentNo(
          manager,
          this.headerEntity,
          'requestNo' as keyof H & string,
          this.numberPrefix,
          input.requestDate,
        );
        const header = manager.create(this.headerEntity, {
          ...input,
          requestNo,
          status: 'DRAFT',
          orderingStatus: 'NONE',
          estimatedTotal: String(estimatedTotalOf(lines)),
          createdBy: actor.id,
          isDeleted: false,
          extraData: input.extraData ?? {},
        } as DeepPartial<H>);
        const saved = await manager.save(this.headerEntity, header);
        await this.writeLines(manager, saved.id, lines);
        return saved;
      },
    );
  }

  /**
   * Sửa đầu đề khi còn DRAFT. Chỉ các trường được truyền (khác undefined) mới được ghi.
   * Chi nhánh không nằm trong patch vì PO đã liên kết có thể đang dùng chi nhánh cũ.
   */
  async updateHeader(
    id: string,
    patch: DraftHeaderPatch,
    outerManager?: EntityManager,
  ): Promise<H> {
    const { extraData, ...fields } = patch;
    if (extraData !== undefined) assertValidExtraData(extraData);
    return runInOptionalTransaction(
      this.dataSource,
      outerManager,
      async (manager) => {
        const header = await this.lockHeader(manager, id);
        assertLinesEditable(header.status as PurchaseRequestStatus);
        const changes = Object.fromEntries(
          Object.entries(fields).filter(([, value]) => value !== undefined),
        );
        Object.assign(header, changes);
        if (extraData !== undefined) {
          header.extraData = mergeExtraData(header.extraData, extraData);
        }
        return manager.save(this.headerEntity, header);
      },
    );
  }

  /** Thay toàn bộ dòng khi còn DRAFT. */
  async replaceDraftLines(
    id: string,
    lines: Array<DraftLineInput & DraftLineFields>,
    outerManager?: EntityManager,
  ): Promise<H> {
    assertValidDraftLines(lines);
    return runInOptionalTransaction(
      this.dataSource,
      outerManager,
      async (manager) => {
        const header = await this.lockHeader(manager, id);
        assertLinesEditable(header.status as PurchaseRequestStatus);
        await manager.delete(this.lineEntity, {
          [this.lineForeignKey]: id,
        } as never);
        await this.writeLines(manager, id, lines);
        header.estimatedTotal = String(estimatedTotalOf(lines));
        await manager.save(this.headerEntity, header);
        return header;
      },
    );
  }

  /**
   * Xóa mềm đề nghị nháp. Chặn khi không còn DRAFT hoặc khi đã có số lượng được đơn mua giữ.
   */
  async softDeleteDraft(id: string): Promise<H> {
    return this.dataSource.transaction(async (manager) => {
      const header = await this.lockHeader(manager, id);
      assertLinesEditable(header.status as PurchaseRequestStatus);
      assertNoHeldQty(await this.loadLineQty(manager, id));
      header.isDeleted = true;
      return manager.save(this.headerEntity, header);
    });
  }

  /**
   * Xóa cứng đề nghị nháp cùng dòng. Chặn khi còn đơn mua tham chiếu (kể cả đơn đã xóa mềm),
   * vì khóa ngoại từ đơn mua tới đề nghị là RESTRICT.
   */
  async hardDeleteDraft(id: string): Promise<void> {
    return this.dataSource.transaction(async (manager) => {
      const header = await this.lockHeader(manager, id, true);
      assertLinesEditable(header.status as PurchaseRequestStatus);
      assertNoHeldQty(await this.loadLineQty(manager, id));
      await this.assertNoDependentOrders(manager, id);
      await manager.delete(this.lineEntity, {
        [this.lineForeignKey]: id,
      } as never);
      await manager.delete(this.headerEntity, id);
    });
  }

  /**
   * Chặn xóa cứng khi có đơn mua tham chiếu. Lớp con ghi đè bằng entity đơn mua của mình.
   * Lớp cơ sở không biết entity đơn mua nên không kiểm gì.
   */
  protected async assertNoDependentOrders(
    manager: EntityManager,
    id: string,
  ): Promise<void> {
    await Promise.resolve([manager, id]);
  }

  /**
   * CUSTOM: chuẩn bị dòng trước khi ghi, trong cùng transaction (ví dụ chuẩn hóa mã hàng theo danh mục).
   * Không đổi số lượng hay đơn giá. Mặc định trả nguyên dòng.
   */
  protected prepareLines(
    _manager: EntityManager,
    lines: Array<DraftLineInput & DraftLineFields>,
  ): Promise<Array<DraftLineInput & DraftLineFields>> {
    return Promise.resolve(lines);
  }

  private async writeLines(
    manager: EntityManager,
    headerId: string,
    input: Array<DraftLineInput & DraftLineFields>,
  ): Promise<void> {
    const lines = await this.prepareLines(manager, input);
    lines.forEach((l) => {
      if (l.extraData !== undefined) assertValidExtraData(l.extraData);
    });
    const rows = lines.map((l, i) =>
      manager.create(this.lineEntity, {
        ...l,
        lineNo: i + 1,
        [this.lineForeignKey]: headerId,
        qtyRequested: String(l.qtyRequested),
        qtyOrdered: '0',
        estUnitPrice: l.estUnitPrice == null ? null : String(l.estUnitPrice),
        estAmount:
          l.estUnitPrice == null
            ? null
            : String(l.qtyRequested * l.estUnitPrice),
        extraData: l.extraData ?? {},
      } as DeepPartial<L>),
    );
    await manager.save(this.lineEntity, rows);
  }

  /** Khóa dòng đề nghị. `includeDeleted` chỉ dùng cho xóa cứng phiếu đã xóa mềm. */
  protected async lockHeader(
    manager: EntityManager,
    id: string,
    includeDeleted = false,
  ): Promise<H> {
    const header = await manager.findOne(this.headerEntity, {
      where: (includeDeleted
        ? { id }
        : { id, isDeleted: false }) as FindOptionsWhere<H>,
      lock: { mode: 'pessimistic_write' },
    });
    if (!header) throw new NotFoundException('Không tìm thấy đề nghị mua');
    return header;
  }

  protected async loadLineQty(
    manager: EntityManager,
    id: string,
  ): Promise<RequestLineQty[]> {
    const lines = await manager.find(this.lineEntity, {
      where: { [this.lineForeignKey]: id } as FindOptionsWhere<L>,
    });
    return lines.map((l) => ({
      qtyRequested: Number(l.qtyRequested),
      qtyOrdered: Number(l.qtyOrdered),
    }));
  }

  /** Ghi các cột duyệt tương ứng với hành động. */
  protected applyFields(
    header: H,
    action: PurchaseRequestAction,
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
        break;
      case 'reject':
        header.rejectedBy = actorId;
        header.rejectedAt = now;
        header.rejectReason = reason;
        break;
      case 'cancel':
        header.cancelledBy = actorId;
        header.cancelledAt = now;
        header.cancelReason = reason;
        break;
      case 'close':
        header.closedBy = actorId;
        header.closedAt = now;
        header.closeReason = reason;
        break;
      case 'recall':
        break;
    }
  }
}
