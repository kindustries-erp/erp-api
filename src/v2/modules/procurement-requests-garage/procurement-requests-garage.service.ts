import { Injectable } from '@nestjs/common';
import { ErpResource, RbacCoreService } from '@/v2/core/rbac-core';
import { ApproverDirectoryService } from '@/v2/core/approval-core/approver-directory.service';
import { toPurchaseRequestResponse } from '@/v2/core/procurement-requests-core/helpers/procurement-request.mapper';
import {
  PurchaseRequestAction,
  PurchaseRequestStatus,
} from '@/v2/core/procurement-requests-core/contracts/procurement-requests.contract';
import {
  PurchaseRequestPoDraftDto,
  PurchaseRequestResponseDto,
} from '@/v2/core/procurement-requests-core/dto/procurement-request-response.dto';
import { resolvePurchaseRequestPeople } from '@/v2/core/procurement-requests-core/helpers/procurement-request-people';
import { remainingPoDraftLinesOf } from '@/v2/core/procurement-requests-core/services/procurement-request-engine.service';
import { toApprovalEventResponse } from '@/v2/core/approval-core/helpers/approval-event.mapper';
import { ApprovalActorService } from '@/v2/core/approval-core/approval-actor.service';
import { ApprovalEventResponseDto } from '@/v2/core/approval-core/dto/approval-event-response.dto';
import { isNewCashflowSource } from '@/v2/modules/cashflow-garage/cashflow-garage-source';
import { LegacyPurchaseRequestQueryService } from '@/v2/modules/cashflow-garage/compat/legacy-purchase-request-query.service';
import { LegacyPurchaseRequestWriteService } from '@/v2/modules/cashflow-garage/compat/legacy-purchase-request-write.service';
import {
  CreateProcurementRequestDto,
  ListProcurementRequestsDto,
  ReplaceRequestLinesDto,
  UpdateProcurementRequestHeaderDto,
} from './dto/procurement-request.dto';
import { GarageProcurementRequestCommandService } from './services/procurement-request-command.service';
import { GarageProcurementRequestQueryService } from './services/procurement-request-query.service';

/**
 * Facade: điều phối giữa command, query và chuyển sang response DTO.
 * CASHFLOW_GARAGE_SOURCE=new: đọc/ghi trên dự chi PURCHASE (cashflow_forecasts), không đụng bảng PR cũ.
 * Mặc định: giữ đường cũ.
 */
@Injectable()
export class GarageProcurementRequestsService {
  constructor(
    private readonly command: GarageProcurementRequestCommandService,
    private readonly query: GarageProcurementRequestQueryService,
    private readonly cashflowQuery: LegacyPurchaseRequestQueryService,
    private readonly cashflowWrite: LegacyPurchaseRequestWriteService,
    private readonly rbac: RbacCoreService,
    private readonly actors: ApprovalActorService,
    private readonly approvers: ApproverDirectoryService,
  ) {}

  async create(
    dto: CreateProcurementRequestDto,
    actorId: string,
  ): Promise<PurchaseRequestResponseDto> {
    const { lines, ...header } = dto;
    if (isNewCashflowSource()) {
      const id = await this.cashflowWrite.createDraft(
        { id: actorId, roles: await this.roles(actorId) },
        header,
        lines,
      );
      return this.findOne(id);
    }
    const saved = await this.command.createDraft(
      { id: actorId, roles: await this.roles(actorId) },
      header,
      lines,
    );
    return this.findOne(saved.id);
  }

  async list(dto: ListProcurementRequestsDto) {
    if (isNewCashflowSource()) {
      const out = await this.cashflowQuery.list({
        status: dto.status,
        branchId: dto.branchId,
        search: dto.search,
        page: dto.page,
        pageSize: dto.pageSize,
      });
      const people = await resolvePurchaseRequestPeople(this.actors, out.rows);
      return {
        ...out,
        rows: out.rows.map((h) =>
          toPurchaseRequestResponse(h, [], people.get(h.id)),
        ),
      };
    }
    const out = await this.query.list(dto);
    const people = await resolvePurchaseRequestPeople(this.actors, out.rows);
    return {
      ...out,
      rows: out.rows.map((h) =>
        toPurchaseRequestResponse(h, [], people.get(h.id)),
      ),
    };
  }

  /**
   * Gợi ý giá trị cột. Chỉ có ở đường cũ: bộ lọc cột theo bảng PR cũ chưa có trên dự chi.
   * Khi cờ new, trả rỗng để không gợi ý giá trị lấy từ bảng cũ đã đóng băng.
   */
  findColumnOptions(
    column: string,
    search: string | undefined,
    page: number,
    pageSize: number,
    filters?: string,
  ) {
    if (isNewCashflowSource()) {
      return Promise.resolve({ items: [], total: 0, next: null });
    }
    return this.query.findColumnOptions(
      column,
      search,
      page,
      pageSize,
      filters,
    );
  }

  async findOne(id: string): Promise<PurchaseRequestResponseDto> {
    if (isNewCashflowSource()) {
      const { header, lines } = await this.cashflowQuery.findOne(id);
      const people = await resolvePurchaseRequestPeople(this.actors, [header]);
      return toPurchaseRequestResponse(header, lines, people.get(header.id));
    }
    const { header, lines } = await this.query.findOne(id);
    const people = await resolvePurchaseRequestPeople(this.actors, [header]);
    return toPurchaseRequestResponse(header, lines, people.get(header.id));
  }

  async updateHeader(
    id: string,
    dto: UpdateProcurementRequestHeaderDto,
  ): Promise<PurchaseRequestResponseDto> {
    if (isNewCashflowSource()) {
      await this.cashflowWrite.updateHeader(id, dto);
    } else {
      await this.command.updateHeader(id, dto);
    }
    return this.findOne(id);
  }

  async replaceLines(
    id: string,
    dto: ReplaceRequestLinesDto,
  ): Promise<PurchaseRequestResponseDto> {
    if (isNewCashflowSource()) {
      await this.cashflowWrite.replaceDraftLines(id, dto.lines);
    } else {
      await this.command.replaceDraftLines(id, dto.lines);
    }
    return this.findOne(id);
  }

  async transition(
    id: string,
    action: PurchaseRequestAction,
    actorId: string,
    reason?: string,
    approverId?: string | null,
  ): Promise<PurchaseRequestResponseDto> {
    if (approverId) {
      await this.approvers.assertEligible(
        ErpResource.GARAGE_PROCUREMENT_REQUESTS,
        approverId,
        actorId,
      );
    }
    const actor = { id: actorId, roles: await this.roles(actorId) };
    if (isNewCashflowSource()) {
      await this.cashflowWrite.transition(
        id,
        action,
        actor,
        reason,
        approverId ?? null,
      );
    } else {
      await this.command.transition(
        id,
        action,
        actor,
        reason,
        approverId ?? null,
      );
    }
    return this.findOne(id);
  }

  /** Xóa mềm đề nghị nháp. */
  async softDelete(id: string): Promise<{ id: string }> {
    if (isNewCashflowSource()) {
      await this.cashflowWrite.softDeleteDraft(id);
    } else {
      await this.command.softDeleteDraft(id);
    }
    return { id };
  }

  /** Xóa cứng đề nghị nháp (chỉ admin, qua quyền PURGE). */
  async hardDelete(id: string): Promise<{ id: string }> {
    if (isNewCashflowSource()) {
      await this.cashflowWrite.hardDeleteDraft(id);
    } else {
      await this.command.hardDeleteDraft(id);
    }
    return { id };
  }

  async approvalEvents(id: string): Promise<ApprovalEventResponseDto[]> {
    if (isNewCashflowSource()) {
      await this.cashflowQuery.findOne(id);
      const events = await this.cashflowQuery.approvalEvents(id);
      const actors = await this.actors.resolve(events.map((e) => e.actorId));
      return events.map((e) =>
        toApprovalEventResponse(e, actors.get(e.actorId)),
      );
    }
    await this.query.findOne(id);
    const events = await this.query.approvalEvents(id);
    const actors = await this.actors.resolve(events.map((e) => e.actorId));
    return events.map((e) => toApprovalEventResponse(e, actors.get(e.actorId)));
  }

  /** Điền sẵn PO Garage từ phần còn lại của đề nghị đã duyệt. Chỉ đọc. */
  async poDraft(id: string): Promise<PurchaseRequestPoDraftDto> {
    if (isNewCashflowSource()) {
      const { header, lines } = await this.cashflowQuery.findOne(id);
      return this.buildPoDraft(
        header.id,
        header.requestNo,
        header.status,
        lines,
      );
    }
    const { header, lines } = await this.query.findOne(id);
    return this.buildPoDraft(header.id, header.requestNo, header.status, lines);
  }

  private buildPoDraft(
    requestId: string,
    requestNo: string,
    status: string,
    lines: Array<{
      id: string;
      lineNo: number;
      lineType: string;
      itemId: string | null;
      itemCode: string | null;
      itemName: string | null;
      description: string | null;
      qtyRequested: string;
      qtyOrdered: string;
      estUnitPrice: string | null;
    }>,
  ): PurchaseRequestPoDraftDto {
    const draftLines = remainingPoDraftLinesOf(
      status as PurchaseRequestStatus,
      lines.map((l) => ({
        id: l.id,
        lineNo: l.lineNo,
        lineType: l.lineType as 'GOODS' | 'SERVICE',
        itemId: l.itemId,
        itemCode: l.itemCode,
        itemName: l.itemName,
        description: l.description,
        qtyRequested: Number(l.qtyRequested),
        qtyOrdered: Number(l.qtyOrdered),
        estUnitPrice: l.estUnitPrice == null ? null : Number(l.estUnitPrice),
      })),
    );
    return {
      requestId,
      requestNo,
      lines: draftLines.map((l) => ({
        ...l,
        qtyRemaining: Number(l.qtyRemaining.toFixed(3)),
      })),
    };
  }

  private roles(userId: string): Promise<string[]> {
    return this.rbac.getUserRoleNames(userId);
  }
}
