import { Injectable } from '@nestjs/common';
import { RbacCoreService } from '@/v2/core/rbac-core';
import { toPurchaseRequestResponse } from '@/v2/core/procurement-requests-core/helpers/procurement-request.mapper';
import {
  PurchaseRequestAction,
  PurchaseRequestStatus,
} from '@/v2/core/procurement-requests-core/contracts/procurement-requests.contract';
import {
  PurchaseRequestPoDraftDto,
  PurchaseRequestResponseDto,
} from '@/v2/core/procurement-requests-core/dto/procurement-request-response.dto';
import { remainingPoDraftLinesOf } from '@/v2/core/procurement-requests-core/services/procurement-request-engine.service';
import { toApprovalEventResponse } from '@/v2/core/approval-core/helpers/approval-event.mapper';
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

  async list(dto: ListProcurementRequestsDto) {
    const out = await this.query.list(dto);
    return {
      ...out,
      rows: out.rows.map((h) => toPurchaseRequestResponse(h, [])),
    };
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
    return toPurchaseRequestResponse(header, lines);
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
  ): Promise<PurchaseRequestResponseDto> {
    await this.command.transition(
      id,
      action,
      { id: actorId, roles: await this.roles(actorId) },
      reason,
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
    return events.map(toApprovalEventResponse);
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
