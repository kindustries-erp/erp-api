import { toApprovalEventResponse } from '@/v2/core/approval/helpers/approval-event.mapper';
import { ApprovalEventResponseDto } from '@/v2/core/approval/dto/approval-event-response.dto';
import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { RbacCoreService } from '@/v2/core/rbac';
import { toProcurementOrderResponse } from '@/v2/core/procurement-orders/helpers/procurement-order.mapper';
import { ProcurementOrderAction } from '@/v2/core/procurement-orders/contracts/procurement-orders.contract';
import { ProcurementOrderResponseDto } from '@/v2/core/procurement-orders/dto/procurement-order-response.dto';
import {
  AcceptServicesDto,
  CreateProcurementOrderDto,
  ListProcurementOrdersDto,
  ReceiveGoodsDto,
  ReplaceOrderLinesDto,
} from './dto/procurement-order.dto';
import { GarageProcurementOrderCommandService } from './services/procurement-order-command.service';
import { GarageProcurementOrderFulfilmentService } from './services/procurement-order-fulfilment.service';
import { GarageProcurementOrderQueryService } from './services/procurement-order-query.service';

/** Facade: điều phối command, giao nhận, query và chuyển sang response DTO. */
@Injectable()
export class GarageProcurementOrdersService {
  constructor(
    private readonly command: GarageProcurementOrderCommandService,
    private readonly fulfilment: GarageProcurementOrderFulfilmentService,
    private readonly query: GarageProcurementOrderQueryService,
    private readonly rbac: RbacCoreService,
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

  async list(dto: ListProcurementOrdersDto) {
    const out = await this.query.list(
      dto.page ?? 1,
      dto.pageSize ?? 20,
      dto.branchId,
    );
    return {
      ...out,
      rows: out.rows.map((h) => toProcurementOrderResponse(h, [])),
    };
  }

  async findOne(id: string): Promise<ProcurementOrderResponseDto> {
    const { header, lines } = await this.query.findOne(id);
    return toProcurementOrderResponse(header, lines);
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
    return events.map(toApprovalEventResponse);
  }

  private roles(userId: string): Promise<string[]> {
    return this.rbac.getUserRoleNames(userId);
  }
}
