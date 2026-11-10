import { toApprovalEventResponse } from '@/v2/core/approval-core/helpers/approval-event.mapper';
import { ApprovalActorService } from '@/v2/core/approval-core/approval-actor.service';
import { ApprovalEventResponseDto } from '@/v2/core/approval-core/dto/approval-event-response.dto';
import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { RbacCoreService } from '@/v2/core/rbac-core';
import { toProcurementOrderResponse } from '@/v2/core/procurement-orders-core/helpers/procurement-order.mapper';
import { resolveApprovalEmails } from '@/v2/core/approval-core/helpers/approval-people';
import { ProcurementOrderAction } from '@/v2/core/procurement-orders-core/contracts/procurement-orders.contract';
import { ProcurementOrderResponseDto } from '@/v2/core/procurement-orders-core/dto/procurement-order-response.dto';
import { ProcurementOrderListResponseDto } from '@/v2/core/procurement-orders-core/dto/procurement-order-list-response.dto';
import { toPaginatedResult } from '@/common/utils/paginated-result';
import {
  AcceptServicesDto,
  CreateProcurementOrderDto,
  ListProcurementOrdersDto,
  ReceiveGoodsDto,
  ReplaceOrderLinesDto,
} from './dto/procurement-order.dto';
import { ProcurementOrderCommandService } from './services/procurement-order-command.service';
import { ProcurementOrderFulfilmentService } from './services/procurement-order-fulfilment.service';
import { ProcurementOrderQueryService } from './services/procurement-order-query.service';

/** Facade: điều phối command, giao nhận, query và chuyển sang response DTO. */
@Injectable()
export class ErpProcurementOrdersService {
  constructor(
    private readonly command: ProcurementOrderCommandService,
    private readonly fulfilment: ProcurementOrderFulfilmentService,
    private readonly query: ProcurementOrderQueryService,
    private readonly rbac: RbacCoreService,
    private readonly actors: ApprovalActorService,
    private readonly dataSource: DataSource,
  ) {}

  async create(
    dto: CreateProcurementOrderDto,
    actorId: string,
  ): Promise<ProcurementOrderResponseDto> {
    const { lines, ...header } = dto;
    const saved = await this.command.createDraft(
      { id: actorId, roles: await this.roles(actorId) },
      header,
      lines,
    );
    return this.findOne(saved.id);
  }

  async list(
    dto: ListProcurementOrdersDto,
  ): Promise<ProcurementOrderListResponseDto> {
    const out = await this.query.list(
      dto.page ?? 1,
      dto.pageSize ?? 20,
      dto.summary_keys,
    );
    const emailOf = await resolveApprovalEmails(this.actors, out.rows);
    return toPaginatedResult(
      out.rows.map((h) => toProcurementOrderResponse(h, [], emailOf)),
      out.page,
      out.pageSize,
      out.total,
      out.summaries,
    );
  }

  async findOne(id: string): Promise<ProcurementOrderResponseDto> {
    const { header, lines } = await this.query.findOne(id);
    const emailOf = await resolveApprovalEmails(this.actors, [header]);
    return toProcurementOrderResponse(header, lines, emailOf);
  }

  async replaceLines(
    id: string,
    dto: ReplaceOrderLinesDto,
  ): Promise<ProcurementOrderResponseDto> {
    await this.command.replaceDraftLines(id, dto.lines);
    return this.findOne(id);
  }

  async transition(
    id: string,
    action: ProcurementOrderAction,
    actorId: string,
    reason?: string,
  ): Promise<ProcurementOrderResponseDto> {
    await this.command.transition(
      id,
      action,
      { id: actorId, roles: await this.roles(actorId) },
      reason,
    );
    return this.findOne(id);
  }

  /** Nhận hàng GOODS: lệnh này được gọi từ phiếu nhập kho, trong cùng transaction. */
  async receiveGoods(
    id: string,
    dto: ReceiveGoodsDto,
  ): Promise<ProcurementOrderResponseDto> {
    await this.dataSource.transaction((m) =>
      this.fulfilment.applyGoodsReceipt(m, id, dto.items),
    );
    return this.findOne(id);
  }

  async acceptServices(
    id: string,
    dto: AcceptServicesDto,
    actorId: string,
  ): Promise<ProcurementOrderResponseDto> {
    await this.dataSource.transaction((m) =>
      this.fulfilment.accept(m, id, actorId, dto.items),
    );
    return this.findOne(id);
  }

  async voidAcceptance(
    id: string,
    acceptanceId: string,
    actorId: string,
    reason: string,
  ): Promise<ProcurementOrderResponseDto> {
    await this.dataSource.transaction((m) =>
      this.fulfilment.voidAcceptance(m, id, acceptanceId, actorId, reason),
    );
    return this.findOne(id);
  }

  async approvalEvents(id: string): Promise<ApprovalEventResponseDto[]> {
    await this.query.findOne(id);
    const events = await this.query.approvalEvents(id);
    const actors = await this.actors.resolve(events.map((e) => e.actorId));
    return events.map((e) => toApprovalEventResponse(e, actors.get(e.actorId)));
  }

  private roles(userId: string): Promise<string[]> {
    return this.rbac.getUserRoleNames(userId);
  }
}
