import { Injectable } from '@nestjs/common';
import { RbacCoreService } from '@/rbac-core/rbac-core.service';
import { toPurchaseRequestResponse } from '@/v2/core/procurement-requests/helpers/procurement-request.mapper';
import {
  PurchaseRequestAction,
  PurchaseRequestStatus,
} from '@/v2/core/procurement-requests/contracts/procurement-requests.contract';
import {
  PurchaseRequestPoDraftDto,
  PurchaseRequestResponseDto,
} from '@/v2/core/procurement-requests/dto/procurement-request-response.dto';
import { remainingPoDraftLinesOf } from '@/v2/core/procurement-requests/services/procurement-request-engine.service';
import { toApprovalEventResponse } from '@/v2/core/approval/helpers/approval-event.mapper';
import { ApprovalEventResponseDto } from '@/v2/core/approval/dto/approval-event-response.dto';
import {
  CreateProcurementRequestDto,
  ListProcurementRequestsDto,
  ReplaceRequestLinesDto,
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
    const page = dto.page ?? 1;
    const pageSize = dto.pageSize ?? 20;
    const out = await this.query.list(page, pageSize, dto.branchId);
    return {
      ...out,
      rows: out.rows.map((h) => toPurchaseRequestResponse(h, [])),
    };
  }

  async findOne(id: string): Promise<PurchaseRequestResponseDto> {
    const { header, lines } = await this.query.findOne(id);
    return toPurchaseRequestResponse(header, lines);
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
