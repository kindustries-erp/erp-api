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
import { PurchaseRequestListResponseDto } from '@/v2/core/procurement-requests-core/dto/procurement-request-list-response.dto';
import { toPaginatedResult } from '@/common/utils/paginated-result';
import { resolveApprovalEmails } from '@/v2/core/approval-core/helpers/approval-people';
import { remainingPoDraftLinesOf } from '@/v2/core/procurement-requests-core/services/procurement-request-engine.service';
import { toApprovalEventResponse } from '@/v2/core/approval-core/helpers/approval-event.mapper';
import { ApprovalActorService } from '@/v2/core/approval-core/approval-actor.service';
import { ApprovalEventResponseDto } from '@/v2/core/approval-core/dto/approval-event-response.dto';
import {
  CreateProcurementRequestDto,
  ListProcurementRequestsDto,
  ReplaceRequestLinesDto,
  UpdateProcurementRequestHeaderDto,
} from './dto/procurement-request.dto';
import { GarageProcurementRequestCommandService } from './services/procurement-request-command.service';
import { GarageProcurementRequestQueryService } from './services/procurement-request-query.service';

/** Facade: điều phối giữa command, query và chuyển sang response DTO. */
@Injectable()
export class GarageProcurementRequestsService {
  constructor(
    private readonly command: GarageProcurementRequestCommandService,
    private readonly query: GarageProcurementRequestQueryService,
    private readonly rbac: RbacCoreService,
    private readonly actors: ApprovalActorService,
    private readonly approvers: ApproverDirectoryService,
  ) {}

  async create(
    dto: CreateProcurementRequestDto,
    actorId: string,
  ): Promise<PurchaseRequestResponseDto> {
    const { lines, ...header } = dto;
    const saved = await this.command.createDraft(
      { id: actorId, roles: await this.roles(actorId) },
      header,
      lines,
    );
    return this.findOne(saved.id);
  }

  async list(
    dto: ListProcurementRequestsDto,
  ): Promise<PurchaseRequestListResponseDto> {
    const out = await this.query.list(dto);
    const emailOf = await resolveApprovalEmails(this.actors, out.rows);
    return toPaginatedResult(
      out.rows.map((h) => toPurchaseRequestResponse(h, [], emailOf)),
      out.page,
      out.pageSize,
      out.total,
      out.summaries,
    );
  }

  findColumnOptions(
    column: string,
    search: string | undefined,
    page: number,
    pageSize: number,
    filters?: string,
  ) {
    return this.query.findColumnOptions(
      column,
      search,
      page,
      pageSize,
      filters,
    );
  }

  async findOne(id: string): Promise<PurchaseRequestResponseDto> {
    const { header, lines } = await this.query.findOne(id);
    const emailOf = await resolveApprovalEmails(this.actors, [header]);
    return toPurchaseRequestResponse(header, lines, emailOf);
  }

  async updateHeader(
    id: string,
    dto: UpdateProcurementRequestHeaderDto,
  ): Promise<PurchaseRequestResponseDto> {
    await this.command.updateHeader(id, dto);
    return this.findOne(id);
  }

  async replaceLines(
    id: string,
    dto: ReplaceRequestLinesDto,
  ): Promise<PurchaseRequestResponseDto> {
    await this.command.replaceDraftLines(id, dto.lines);
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
    await this.command.transition(
      id,
      action,
      { id: actorId, roles: await this.roles(actorId) },
      reason,
      approverId ?? null,
    );
    return this.findOne(id);
  }

  /** Xóa mềm đề nghị nháp. */
  async softDelete(id: string): Promise<{ id: string }> {
    await this.command.softDeleteDraft(id);
    return { id };
  }

  /** Xóa cứng đề nghị nháp (chỉ admin, qua quyền PURGE). */
  async hardDelete(id: string): Promise<{ id: string }> {
    await this.command.hardDeleteDraft(id);
    return { id };
  }

  async approvalEvents(id: string): Promise<ApprovalEventResponseDto[]> {
    await this.query.findOne(id);
    const events = await this.query.approvalEvents(id);
    const actors = await this.actors.resolve(events.map((e) => e.actorId));
    return events.map((e) => toApprovalEventResponse(e, actors.get(e.actorId)));
  }

  /** Điền sẵn PO Garage từ phần còn lại của đề nghị đã duyệt. Chỉ đọc. */
  async poDraft(id: string): Promise<PurchaseRequestPoDraftDto> {
    const { header, lines } = await this.query.findOne(id);
    const draftLines = remainingPoDraftLinesOf(
      header.status as PurchaseRequestStatus,
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
      requestId: header.id,
      requestNo: header.requestNo,
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
