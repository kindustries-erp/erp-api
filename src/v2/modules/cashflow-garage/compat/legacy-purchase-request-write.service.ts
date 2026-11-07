import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { nextDocumentNo } from '@/common/numbering/document-numbering';
import { ApprovalEventService } from '@/v2/core/approval-core/approval-event.service';
import {
  assertCanDecide,
  loadApprovalMode,
  resolveSubmitDecision,
} from '@/v2/core/approval-core/approval-gate.helper';
import {
  assertNotSelfApproval,
  requireReason,
} from '@/v2/core/approval-core/approval.engine';
import { CASHFLOW_APPROVAL_DOC_TYPE } from '@/v2/core/cashflow-core/contracts/cashflow-approval';
import { CashflowForecast } from '@/v2/core/cashflow-core/entities/cashflow-forecast.entity';
import { CashflowForecastLine } from '@/v2/core/cashflow-core/entities/cashflow-forecast-line.entity';
import {
  PURCHASE_REQUEST_ACTIONS_REQUIRING_APPROVER,
  PURCHASE_REQUEST_ACTIONS_REQUIRING_REASON,
  PurchaseRequestAction,
} from '@/v2/core/procurement-requests-core/contracts/procurement-requests.contract';
import {
  assertCanCancel,
  assertLinesEditable,
  assertNoHeldQty,
  assertValidDraftLines,
  DraftLineInput,
  estimatedTotalOf,
  RequestLineQty,
} from '@/v2/core/procurement-requests-core/services/procurement-request-engine.service';
import { legacyPrStatus } from '../helpers/legacy-pr-status';
import { planForecastPrTransition } from '../helpers/legacy-pr-transition';

/** Số phiếu đề nghị Garage, giữ tiền tố cũ GDNM. */
const PR_NUMBER_PREFIX = 'GDNM';

export interface LegacyPrDraftHeader {
  requestDate: string;
  neededDate?: string | null;
  title?: string | null;
  requesterEmployeeId?: string | null;
  remarks?: string | null;
  branchId?: string | null;
}

export interface LegacyPrHeaderPatch {
  neededDate?: string | null;
  title?: string | null;
  requesterEmployeeId?: string | null;
  remarks?: string | null;
}

export interface LegacyPrLineInput extends DraftLineInput {
  itemId?: string | null;
  itemCode?: string | null;
  itemName?: string | null;
  description?: string | null;
  notes?: string | null;
}

export interface LegacyPrActor {
  id: string;
  roles: string[];
}

/**
 * Ghi đề nghị mua Garage trên dự chi PURCHASE (cashflow_forecasts). Chỉ dùng khi
 * CASHFLOW_GARAGE_SOURCE=new. Mọi thay đổi chạy trong một transaction, khóa dự chi trước,
 * ghi nhật ký duyệt cùng transaction, và trả về đúng quy tắc của đề nghị cũ.
 *
 * Chỗ chưa có cột trên dự chi: requestDate (không sửa được), lý do hủy (chỉ nằm trong nhật ký).
 */
@Injectable()
export class LegacyPurchaseRequestWriteService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly events: ApprovalEventService,
  ) {}

  async createDraft(
    actor: LegacyPrActor,
    input: LegacyPrDraftHeader,
    lines: LegacyPrLineInput[],
  ): Promise<string> {
    assertValidDraftLines(lines);
    return this.dataSource.transaction(async (manager) => {
      const code = await nextDocumentNo(
        manager,
        CashflowForecast,
        'code' as keyof CashflowForecast & string,
        PR_NUMBER_PREFIX,
        input.requestDate,
      );
      const header = await manager.getRepository(CashflowForecast).save(
        manager.create(CashflowForecast, {
          code,
          direction: 'OUT',
          kind: 'PURCHASE',
          source: 'MANUAL',
          sourceType: null,
          sourceId: null,
          partnerId: null,
          partnerName: null,
          branchId: input.branchId ?? null,
          amount: String(estimatedTotalOf(lines)),
          plannedDate: input.neededDate ?? null,
          status: 'DRAFT',
          requiresApproval: false,
          note: input.remarks ?? null,
          title: input.title ?? null,
          requesterEmployeeId: input.requesterEmployeeId ?? null,
          isDeleted: false,
          createdBy: actor.id,
        }),
      );
      await this.writeLines(manager, header.id, lines);
      return header.id;
    });
  }

  /** Sửa đầu đề khi còn nháp. Chỉ trường có giá trị (khác undefined) mới được ghi. */
  async updateHeader(id: string, patch: LegacyPrHeaderPatch): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const header = await this.lockHeader(manager, id);
      assertLinesEditable(legacyPrStatus(header.status, null));
      const changes: Partial<CashflowForecast> = {};
      if (patch.neededDate !== undefined)
        changes.plannedDate = patch.neededDate;
      if (patch.title !== undefined) changes.title = patch.title;
      if (patch.requesterEmployeeId !== undefined)
        changes.requesterEmployeeId = patch.requesterEmployeeId;
      if (patch.remarks !== undefined) changes.note = patch.remarks;
      if (Object.keys(changes).length === 0) return;
      await manager.update(CashflowForecast, { id }, changes);
    });
  }

  /** Thay toàn bộ dòng khi còn nháp. Tổng dự kiến cập nhật theo dòng mới. */
  async replaceDraftLines(
    id: string,
    lines: LegacyPrLineInput[],
  ): Promise<void> {
    assertValidDraftLines(lines);
    await this.dataSource.transaction(async (manager) => {
      const header = await this.lockHeader(manager, id);
      assertLinesEditable(legacyPrStatus(header.status, null));
      await manager.delete(CashflowForecastLine, { forecastId: id });
      await this.writeLines(manager, id, lines);
      await manager.update(
        CashflowForecast,
        { id },
        {
          amount: String(estimatedTotalOf(lines)),
        },
      );
    });
  }

  /**
   * Chuyển trạng thái. `approverId` chỉ dùng cho gửi duyệt. Khi khóa duyệt tắt,
   * gửi duyệt tự duyệt và ghi AUTO_APPROVED, cùng quy tắc với đề nghị cũ.
   */
  async transition(
    id: string,
    action: PurchaseRequestAction,
    actor: LegacyPrActor,
    reason?: string,
    approverId?: string | null,
  ): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const header = await this.lockHeader(manager, id);
      const mode = await loadApprovalMode(
        manager,
        CASHFLOW_APPROVAL_DOC_TYPE.FORECAST_OUT,
      );

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

      const plan = planForecastPrTransition(
        { status: header.status, closedAt: await this.closedAt(manager, id) },
        action,
      );
      const decision =
        action === 'submit'
          ? resolveSubmitDecision(mode, actor.id, approverId)
          : null;
      const autoApprove = decision?.autoApprove === true;

      const now = new Date();
      const patch: Partial<CashflowForecast> = { status: plan.next.status };
      switch (action) {
        case 'submit':
          patch.submittedBy = actor.id;
          patch.submittedAt = now;
          break;
        case 'recall':
          patch.approverId = null;
          break;
        case 'reject':
          patch.rejectedBy = actor.id;
          patch.rejectedAt = now;
          patch.rejectReason = cleanReason;
          patch.approverId = null;
          break;
        case 'approve':
          patch.approvedBy = actor.id;
          patch.approvedAt = now;
          break;
        default:
          break;
      }
      if (decision) {
        patch.approverId = decision.approverId;
        if (autoApprove) {
          patch.status = 'OPEN';
          patch.approvedBy = actor.id;
          patch.approvedAt = now;
        }
      }
      await manager.update(CashflowForecast, { id }, patch);

      if (plan.next.closed) {
        await this.markClosed(manager, id, actor.id, cleanReason);
      }

      await this.events.record(manager, {
        docType: CASHFLOW_APPROVAL_DOC_TYPE.FORECAST_OUT,
        docId: id,
        action: autoApprove ? 'AUTO_APPROVED' : action,
        fromStatus: plan.from,
        toStatus: autoApprove ? 'APPROVED' : plan.to,
        actorId: actor.id,
        actorRoles: actor.roles,
        comment: cleanReason,
      });
    });
  }

  /** Xóa mềm đề nghị nháp. Chặn khi đã có số lượng được đơn mua giữ. */
  async softDeleteDraft(id: string): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const header = await this.lockHeader(manager, id);
      assertLinesEditable(legacyPrStatus(header.status, null));
      assertNoHeldQty(await this.loadLineQty(manager, id));
      await manager.update(CashflowForecast, { id }, { isDeleted: true });
    });
  }

  /**
   * Xóa cứng đề nghị nháp cùng dòng. Chặn khi còn đơn mua tham chiếu (kể cả đơn đã xóa mềm),
   * vì khóa ngoại từ đơn mua tới đề nghị là RESTRICT. Quyền xóa cứng kiểm ở controller.
   */
  async hardDeleteDraft(id: string): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const header = await this.lockHeader(manager, id);
      assertLinesEditable(legacyPrStatus(header.status, null));
      assertNoHeldQty(await this.loadLineQty(manager, id));
      const [{ n }] = await manager.query(
        `SELECT count(*)::int AS n FROM erp_garage_proc_orders WHERE request_id = $1`,
        [id],
      );
      if (n > 0) {
        throw new ConflictException(
          'Không xóa cứng được đề nghị đã có đơn mua tham chiếu',
        );
      }
      await manager.delete(CashflowForecastLine, { forecastId: id });
      await manager.delete(CashflowForecast, { id });
    });
  }

  private async writeLines(
    manager: EntityManager,
    forecastId: string,
    lines: LegacyPrLineInput[],
  ): Promise<void> {
    const rows = lines.map((l, i) =>
      manager.create(CashflowForecastLine, {
        forecastId,
        lineNo: i + 1,
        lineType: l.lineType as 'GOODS' | 'SERVICE', // đã kiểm ở assertValidDraftLines
        itemId: l.itemId ?? null,
        itemCode: l.itemCode ?? null,
        itemName: l.itemName || l.itemCode || '(không tên)',
        description: l.description ?? null,
        notes: l.notes ?? null,
        qtyRequested: String(l.qtyRequested),
        qtyOrdered: '0',
        unitPrice: String(l.estUnitPrice ?? 0),
        amount: String(l.qtyRequested * (l.estUnitPrice ?? 0)),
      }),
    );
    await manager.save(CashflowForecastLine, rows);
  }

  /** Khóa dự chi PR (pessimistic_write) trước khi kiểm tra và ghi. */
  private async lockHeader(
    manager: EntityManager,
    id: string,
  ): Promise<CashflowForecast> {
    const header = await manager.findOne(CashflowForecast, {
      where: { id, kind: 'PURCHASE', isDeleted: false },
      lock: { mode: 'pessimistic_write' },
    });
    if (!header) throw new NotFoundException('Không tìm thấy đề nghị mua');
    return header;
  }

  private async loadLineQty(
    manager: EntityManager,
    id: string,
  ): Promise<RequestLineQty[]> {
    const lines = await manager.find(CashflowForecastLine, {
      where: { forecastId: id },
    });
    return lines.map((l) => ({
      qtyRequested: Number(l.qtyRequested),
      qtyOrdered: Number(l.qtyOrdered),
    }));
  }

  private async closedAt(
    manager: EntityManager,
    id: string,
  ): Promise<Date | null> {
    const [row] = await manager.query(
      `SELECT closed_at FROM cashflow_garage_forecast_ext WHERE forecast_id = $1`,
      [id],
    );
    return row?.closed_at ?? null;
  }

  /** Dấu đóng PR: ext.closed_at, người đóng và lý do. Tạo dòng ext nếu chưa có. */
  private async markClosed(
    manager: EntityManager,
    id: string,
    actorId: string,
    reason: string | null,
  ): Promise<void> {
    await manager.query(
      `INSERT INTO cashflow_garage_forecast_ext
         (forecast_id, is_auto_expected, is_auto_commission, debt_counted, closed_at, closed_by, close_reason)
       VALUES ($1, false, false, true, now(), $2, $3)
       ON CONFLICT (forecast_id) DO UPDATE SET
         closed_at = now(), closed_by = EXCLUDED.closed_by, close_reason = EXCLUDED.close_reason`,
      [id, actorId, reason],
    );
  }
}
