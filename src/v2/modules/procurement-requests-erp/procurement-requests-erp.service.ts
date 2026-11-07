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
import { resolvePurchaseRequestPeople } from '@/v2/core/procurement-requests-core/helpers/procurement-request-people';
import { remainingPoDraftLinesOf } from '@/v2/core/procurement-requests-core/services/procurement-request-engine.service';
import { toApprovalEventResponse } from '@/v2/core/approval-core/helpers/approval-event.mapper';
import { ApprovalActorService } from '@/v2/core/approval-core/approval-actor.service';
import { ApprovalEventResponseDto } from '@/v2/core/approval-core/dto/approval-event-response.dto';
import {
  CreateProcurementRequestDto,
  ListProcurementRequestsDto,
  ReplaceRequestLinesDto,
} from './dto/procurement-request.dto';
import { ProcurementRequestCommandService } from './services/procurement-request-command.service';
import { ProcurementRequestQueryService } from './services/procurement-request-query.service';

/** Facade: điều phối giữa command, query và chuyển sang response DTO. */
@Injectable()
export class ErpProcurementRequestsService {
  constructor(
    private readonly command: ProcurementRequestCommandService,
    private readonly query: ProcurementRequestQueryService,
    private readonly rbac: RbacCoreService,
    private readonly actors: ApprovalActorService,
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
    const out = await this.query.list(page, pageSize);
    const people = await resolvePurchaseRequestPeople(this.actors, out.rows);
    return {
      ...out,
      rows: out.rows.map((h) =>
        toPurchaseRequestResponse(h, [], people.get(h.id)),
      ),
    };
  }

  async findOne(id: string): Promise<PurchaseRequestResponseDto> {
    const { header, lines } = await this.query.findOne(id);
    const people = await resolvePurchaseRequestPeople(this.actors, [header]);
    return toPurchaseRequestResponse(header, lines, people.get(header.id));
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
    const actors = await this.actors.resolve(events.map((e) => e.actorId));
    return events.map((e) => toApprovalEventResponse(e, actors.get(e.actorId)));
  }

  /** Điền sẵn PO từ phần còn lại của PR đã duyệt. Chỉ đọc, không ghi DB. */
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
