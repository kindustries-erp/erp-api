import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { ApprovalEventService } from '@/v2/modules/approval-management/services/approval-event.service';
import {
  AbstractPurchaseRequestCommandService,
  DraftHeaderPatch,
  DraftLineFields,
} from '@/v2/core/procurement-requests-core/services/abstract-purchase-request-command.service';
import type { DraftLineInput } from '@/v2/core/procurement-requests-core/services/procurement-request-engine.service';
import { GarageLineItemResolver } from '@/v2/modules/items-garage/services/garage-line-item-resolver.service';
import { GarageProcurementOrder } from '@/v2/modules/procurement-orders-garage/entities/procurement-order.entity';
import type {
  DraftHeaderInput,
  RequestActor,
} from '@/v2/core/procurement-requests-core/services/abstract-purchase-request-command.service';
import { GarageProcurementRequest } from '../entities/procurement-request.entity';
import { ProcurementRequestLinkEngine } from './procurement-request-link.engine';
import { GarageProcurementRequestLine } from '../entities/procurement-request-line.entity';

/** Field liên kết cho phép revert/refresh (khóa camelCase, khớp `trackedKeys` của engine). */
const LINK_FIELDS: ReadonlySet<string> = new Set(['branchName']);

/** Chi nhánh trong payload tạo/sửa: `branchId` là FK, `branchName` là tên sửa cục bộ. */
type BranchInput = { branchId?: string | null; branchName?: string | null };

@Injectable()
export class GarageProcurementRequestCommandService extends AbstractPurchaseRequestCommandService<
  GarageProcurementRequest,
  GarageProcurementRequestLine
> {
  protected readonly headerEntity = GarageProcurementRequest;
  protected readonly lineEntity = GarageProcurementRequestLine;
  protected readonly lineForeignKey = 'requestId' as const;
  protected readonly docType = 'GARAGE_PROCUREMENT_REQUEST';
  protected readonly numberPrefix = 'GDNM';
  protected readonly restrictApproverToDecision = true;

  constructor(
    dataSource: DataSource,
    events: ApprovalEventService,
    private readonly itemResolver: GarageLineItemResolver,
    private readonly links: ProcurementRequestLinkEngine,
  ) {
    super(dataSource, events);
  }

  /** Chuẩn hóa mã hàng theo danh mục garage trước khi ghi dòng; mã chưa có sẽ được tạo. */
  protected prepareLines(
    manager: EntityManager,
    lines: Array<DraftLineInput & DraftLineFields>,
  ): Promise<Array<DraftLineInput & DraftLineFields>> {
    return this.itemResolver.resolveLines(manager, lines);
  }

  /**
   * Tạo nháp. Có `branchId`: server đọc chi nhánh để lập snapshot; `branchName` gửi lên khác
   * tên chi nhánh thì được đánh dấu override (không đổi chi nhánh gốc). Chi nhánh không tồn tại → 404.
   */
  async createDraft(
    actor: RequestActor,
    input: DraftHeaderInput & BranchInput,
    lines: Array<DraftLineInput & DraftLineFields>,
    outerManager?: EntityManager,
  ): Promise<GarageProcurementRequest> {
    const linked = input.branchId
      ? await this.links.capture(input.branchId, {
          branchName: input.branchName,
        })
      : null;
    const header = linked
      ? {
          ...input,
          ...linked.values,
          sourceSnapshot: linked.sourceSnapshot,
          overrides: linked.overrides,
        }
      : input;
    return super.createDraft(actor, header, lines, outerManager);
  }

  /**
   * Sửa đầu đề khi nháp. Chi nhánh:
   * - đổi `branchId`: chặn 409 khi đã có đơn mua; còn lại lập lại snapshot từ chi nhánh mới
   *   (tên chi nhánh điền vào `branchName`, trừ khi client gửi tên khác thì đánh dấu override);
   * - chỉ sửa `branchName`: cập nhật override so với snapshot, KHÔNG ghi vào chi nhánh gốc.
   */
  async updateHeader(
    id: string,
    patch: DraftHeaderPatch & BranchInput,
    outerManager?: EntityManager,
  ): Promise<GarageProcurementRequest> {
    if (patch.branchId === undefined && patch.branchName === undefined) {
      return super.updateHeader(id, patch, outerManager);
    }
    const db = outerManager ?? this.dataSource;
    const current = await db
      .getRepository(GarageProcurementRequest)
      .findOne({ where: { id } });
    if (!current) return super.updateHeader(id, patch, outerManager);

    const branchChanged =
      patch.branchId !== undefined &&
      (current.branchId ?? null) !== (patch.branchId ?? null);
    if (branchChanged) await this.assertNoOrders(db, id);

    const branchId =
      patch.branchId !== undefined ? patch.branchId : current.branchId;
    const linked = await this.linkedColumns(
      current,
      patch,
      branchId ?? null,
      branchChanged,
    );
    return super.updateHeader(id, { ...patch, ...linked }, outerManager);
  }

  /** Về giá trị chi nhánh đã lưu trong snapshot (không gọi nguồn). Chỉ khi DRAFT (lõi kiểm). */
  async revertLink(
    id: string,
    field: string,
    outerManager?: EntityManager,
  ): Promise<GarageProcurementRequest> {
    this.assertLinkField(field);
    const current = await this.loadCurrent(id, outerManager);
    const r = this.links.revert([field], this.stateOf(current));
    return this.writeLinked(
      id,
      { ...r.values, overrides: r.overrides },
      outerManager,
    );
  }

  /** Đọc lại chi nhánh và lấy giá trị mới nhất cho `field` (làm mới snapshot). Chỉ khi DRAFT. */
  async refreshLink(
    id: string,
    field: string,
    outerManager?: EntityManager,
  ): Promise<GarageProcurementRequest> {
    this.assertLinkField(field);
    const current = await this.loadCurrent(id, outerManager);
    if (!current.branchId) {
      throw new ConflictException('Đề nghị chưa liên kết chi nhánh');
    }
    const r = await this.links.refresh(
      current.branchId,
      this.stateOf(current),
      [field],
    );
    return this.writeLinked(
      id,
      {
        ...r.values,
        sourceSnapshot: r.sourceSnapshot,
        overrides: r.overrides,
      },
      outerManager,
    );
  }

  /** Ghi cột liên kết qua lõi (khóa dòng, chỉ khi DRAFT); lõi gán mọi trường của patch vào header. */
  private writeLinked(
    id: string,
    columns: Record<string, unknown>,
    outerManager?: EntityManager,
  ): Promise<GarageProcurementRequest> {
    return super.updateHeader(id, columns as DraftHeaderPatch, outerManager);
  }

  private assertLinkField(field: string): void {
    if (!LINK_FIELDS.has(field)) {
      throw new BadRequestException(
        `Field liên kết không hợp lệ: ${field}. Hợp lệ: ${[...LINK_FIELDS].join(', ')}`,
      );
    }
  }

  private async loadCurrent(
    id: string,
    outerManager?: EntityManager,
  ): Promise<GarageProcurementRequest> {
    const db = outerManager ?? this.dataSource;
    const current = await db
      .getRepository(GarageProcurementRequest)
      .findOne({ where: { id, isDeleted: false } });
    if (!current) throw new NotFoundException('Không tìm thấy đề nghị mua');
    return current;
  }

  private stateOf(current: GarageProcurementRequest) {
    return {
      sourceSnapshot: current.sourceSnapshot ?? {},
      overrides: current.overrides ?? {},
    };
  }

  private async assertNoOrders(
    db: DataSource | EntityManager,
    requestId: string,
  ): Promise<void> {
    const orders = await db
      .getRepository(GarageProcurementOrder)
      .count({ where: { requestId } });
    if (orders > 0) {
      throw new ConflictException(
        'Đề nghị đã có đơn mua, không đổi được chi nhánh',
      );
    }
  }

  /** Cột liên kết (`branchName`, `sourceSnapshot`, `overrides`) cần ghi kèm patch. */
  private async linkedColumns(
    current: GarageProcurementRequest,
    patch: BranchInput,
    branchId: string | null,
    branchChanged: boolean,
  ): Promise<Record<string, unknown>> {
    if (!branchId) {
      return branchChanged ? { sourceSnapshot: {}, overrides: {} } : {};
    }
    if (branchChanged) {
      const r = await this.links.capture(branchId, {
        branchName: patch.branchName,
      });
      return {
        ...r.values,
        sourceSnapshot: r.sourceSnapshot,
        overrides: r.overrides,
      };
    }
    if (patch.branchName === undefined) return {};
    let state = {
      sourceSnapshot: current.sourceSnapshot ?? {},
      overrides: current.overrides ?? {},
    };
    if (!('branchName' in state.sourceSnapshot)) {
      // Dòng cũ chưa có snapshot: lập từ chi nhánh, so với tên đang lưu.
      const cap = await this.links.capture(branchId, {
        branchName: current.branchName ?? undefined,
      });
      state = { sourceSnapshot: cap.sourceSnapshot, overrides: cap.overrides };
    }
    return {
      sourceSnapshot: state.sourceSnapshot,
      overrides: this.links.applyEdit({ branchName: patch.branchName }, state),
    };
  }

  /** Đơn mua garage (kể cả đã xóa mềm) giữ khóa ngoại RESTRICT tới đề nghị. */
  protected async assertNoDependentOrders(
    manager: EntityManager,
    id: string,
  ): Promise<void> {
    const count = await manager.count(GarageProcurementOrder, {
      where: { requestId: id },
    });
    if (count > 0) {
      throw new ConflictException(
        'Không xóa cứng được đề nghị đã có đơn mua tham chiếu',
      );
    }
  }
}
