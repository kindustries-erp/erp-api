import { toApprovalEventResponse } from '@/v2/core/approval/helpers/approval-event.mapper';
import { ApprovalEventResponseDto } from '@/v2/core/approval/dto/approval-event-response.dto';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { GarageProcurementRequest } from '../garage-procurement-requests/entities/procurement-request.entity';
import { RbacCoreService } from '@/v2/core/rbac';
import { ProcurementOrderAction } from '@/v2/core/procurement-orders/contracts/procurement-orders.contract';
import {
  AcceptServicesDto,
  CreateProcurementOrderDto,
  ListProcurementOrdersDto,
  ReplaceOrderLinesDto,
  UpdateProcurementOrderHeaderDto,
} from './dto/procurement-order.dto';
import { GarageProcurementOrderResponseDto } from './dto/garage-procurement-order-response.dto';
import { toGarageProcurementOrderResponse } from './helpers/garage-procurement-order.mapper';
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
  ): Promise<GarageProcurementOrderResponseDto> {
    const { lines, ...header } = dto;
    if (header.requestId) {
      await this.assertRequestSameBranch(header.requestId, header.branchId);
    }
    const saved = await this.command.createDraft(
      { id: actorId, roles: await this.roles(actorId) },
      header,
      lines,
    );
    return this.findOne(saved.id);
  }

  async list(dto: ListProcurementOrdersDto) {
    const out = await this.query.list({
      page: dto.page ?? 1,
      pageSize: dto.pageSize ?? 20,
      branchId: dto.branchId,
      status: dto.status,
      supplierId: dto.supplierId,
      dateFrom: dto.dateFrom,
      dateTo: dto.dateTo,
      search: dto.search,
      sort: dto.sort,
      column_filters: dto.column_filters,
      column_search: dto.column_search,
      column_operators: dto.column_operators,
      date_ranges: dto.date_ranges,
    });
    const { createdByEmails, ...page } = out;
    return {
      ...page,
      rows: out.rows.map((h) => ({
        ...toGarageProcurementOrderResponse(h, [], []),
        createdByEmail: h.createdBy
          ? (createdByEmails.get(h.createdBy) ?? null)
          : null,
      })),
    };
  }

  async nextNo(date?: string) {
    return { nextNo: await this.query.nextNo(date) };
  }

  findColumnOptions(
    column: string,
    search: string | undefined,
    page: number,
    pageSize: number,
    filters: unknown,
  ) {
    return this.query.findColumnOptions(
      column,
      search,
      page,
      pageSize,
      filters,
    );
  }

  async findOne(id: string): Promise<GarageProcurementOrderResponseDto> {
    const { header, lines, acceptances } = await this.query.findOne(id);
    return toGarageProcurementOrderResponse(header, lines, acceptances);
  }

  async updateHeader(
    id: string,
    dto: UpdateProcurementOrderHeaderDto,
  ): Promise<GarageProcurementOrderResponseDto> {
    await this.command.updateHeader(id, dto);
    return this.findOne(id);
  }

  /** Xóa mềm đơn nháp và trả số lượng đã giữ trên PR. */
  async softDelete(id: string): Promise<{ id: string }> {
    await this.command.softDeleteDraft(id);
    return { id };
  }

  /** Xóa cứng đơn nháp (chỉ admin, qua quyền PURGE). */
  async hardDelete(id: string): Promise<{ id: string }> {
    await this.command.hardDeleteDraft(id);
    return { id };
  }

  async replaceLines(
    id: string,
    dto: ReplaceOrderLinesDto,
  ): Promise<GarageProcurementOrderResponseDto> {
    await this.command.replaceDraftLines(id, dto.lines);
    return this.findOne(id);
  }

  async transition(
    id: string,
    action: ProcurementOrderAction,
    actorId: string,
    reason?: string,
  ): Promise<GarageProcurementOrderResponseDto> {
    await this.command.transition(
      id,
      action,
      { id: actorId, roles: await this.roles(actorId) },
      reason,
    );
    return this.findOne(id);
  }

  async acceptServices(
    id: string,
    dto: AcceptServicesDto,
    actorId: string,
  ): Promise<GarageProcurementOrderResponseDto> {
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
  ): Promise<GarageProcurementOrderResponseDto> {
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

  /** Đơn mua và đề nghị mua nguồn phải cùng chi nhánh. */
  private async assertRequestSameBranch(
    requestId: string,
    branchId: string,
  ): Promise<void> {
    const request = await this.dataSource
      .getRepository(GarageProcurementRequest)
      .findOne({ where: { id: requestId } });
    if (!request) throw new NotFoundException('Không tìm thấy đề nghị mua');
    if (request.branchId !== branchId) {
      throw new BadRequestException(
        'Đơn mua phải cùng chi nhánh với đề nghị mua nguồn',
      );
    }
  }

  private roles(userId: string): Promise<string[]> {
    return this.rbac.getUserRoleNames(userId);
  }
}
