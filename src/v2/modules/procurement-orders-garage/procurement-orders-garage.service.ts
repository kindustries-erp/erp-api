import { toApprovalEventResponse } from '@/v2/core/approval-core/helpers/approval-event.mapper';
import { ApprovalActorService } from '@/v2/core/approval-core/approval-actor.service';
import { ApprovalEventResponseDto } from '@/v2/core/approval-core/dto/approval-event-response.dto';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { GarageProcurementRequest } from '../procurement-requests-garage/entities/procurement-request.entity';
import { ErpResource, RbacCoreService } from '@/v2/core/rbac-core';
import { ApproverDirectoryService } from '@/v2/core/approval-core/approver-directory.service';
import { resolveApprovalEmails } from '@/v2/core/approval-core/helpers/approval-people';
import { ProcurementOrderAction } from '@/v2/core/procurement-orders-core/contracts/procurement-orders.contract';
import {
  AcceptServicesDto,
  CreateAndConfirmProcurementOrderDto,
  CreateProcurementOrderDto,
  ListProcurementOrdersDto,
  ReplaceOrderLinesDto,
  UpdateAndConfirmProcurementOrderDto,
  UpdateProcurementOrderHeaderDto,
} from './dto/procurement-order.dto';
import { GarageProcurementOrderResponseDto } from './dto/garage-procurement-order-response.dto';
import { GarageProcurementOrderListResponseDto } from './dto/garage-procurement-order-list-response.dto';
import { toPaginatedResult } from '@/common/utils/paginated-result';
import { toGarageProcurementOrderResponse } from './helpers/garage-procurement-order.mapper';
import { GarageProcurementOrderCommandService } from './services/procurement-order-command.service';
import { GarageProcurementOrderFlowService } from './services/garage-procurement-order-flow.service';
import { GarageProcurementOrderFulfilmentService } from './services/procurement-order-fulfilment.service';
import { GarageProcurementOrderQueryService } from './services/procurement-order-query.service';
import { GarageProcurementOrderRequestRefService } from './services/garage-procurement-order-request-ref.service';

/** Facade: điều phối command, giao nhận, query và chuyển sang response DTO. */
@Injectable()
export class GarageProcurementOrdersService {
  constructor(
    private readonly command: GarageProcurementOrderCommandService,
    private readonly fulfilment: GarageProcurementOrderFulfilmentService,
    private readonly query: GarageProcurementOrderQueryService,
    private readonly rbac: RbacCoreService,
    private readonly actors: ApprovalActorService,
    private readonly dataSource: DataSource,
    private readonly approvers: ApproverDirectoryService,
    private readonly flow: GarageProcurementOrderFlowService,
    private readonly requestRef: GarageProcurementOrderRequestRefService,
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

  /** Nhân bản đơn đã từ chối/hủy thành nháp mới (giữ chi nhánh). */
  async clone(
    id: string,
    actorId: string,
  ): Promise<GarageProcurementOrderResponseDto> {
    const saved = await this.command.cloneDraft(
      id,
      { id: actorId, roles: await this.roles(actorId) },
      ['branchId', 'branchName'],
    );
    return this.findOne(saved.id);
  }

  async list(
    dto: ListProcurementOrdersDto,
  ): Promise<GarageProcurementOrderListResponseDto> {
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
      summary_keys: dto.summary_keys,
      deleted: dto.deleted,
    });
    const emailOf = await resolveApprovalEmails(this.actors, out.rows);
    const requestNos = await this.requestRef.requestNos(
      out.rows
        .map((h) => h.requestId)
        .filter((id): id is string => Boolean(id)),
    );
    return toPaginatedResult(
      out.rows.map((h) =>
        toGarageProcurementOrderResponse(
          h,
          [],
          [],
          emailOf,
          h.requestId ? (requestNos.get(h.requestId) ?? null) : null,
        ),
      ),
      out.page,
      out.pageSize,
      out.total,
      out.summaries,
    );
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
    deleted?: 'only',
  ) {
    return this.query.findColumnOptions(
      column,
      search,
      page,
      pageSize,
      filters,
      deleted,
    );
  }

  async findOne(id: string): Promise<GarageProcurementOrderResponseDto> {
    const { header, lines, acceptances } = await this.query.findOne(id);
    const emailOf = await resolveApprovalEmails(this.actors, [header]);
    const requestNo = header.requestId
      ? ((await this.requestRef.requestNos([header.requestId])).get(
          header.requestId,
        ) ?? null)
      : null;
    return toGarageProcurementOrderResponse(
      header,
      lines,
      acceptances,
      emailOf,
      requestNo,
    );
  }

  async updateHeader(
    id: string,
    dto: UpdateProcurementOrderHeaderDto,
  ): Promise<GarageProcurementOrderResponseDto> {
    if (dto.branchId !== undefined) {
      const { header } = await this.query.findOne(id);
      if (header.requestId) {
        await this.assertRequestSameBranch(header.requestId, dto.branchId);
      }
    }
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
    approverId?: string | null,
  ): Promise<GarageProcurementOrderResponseDto> {
    if (approverId) {
      await this.approvers.assertEligible(
        ErpResource.GARAGE_PROCUREMENT_ORDERS,
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

  /** Tạo đơn rồi gửi duyệt/ghi nhận trong một bước (một transaction qua orchestrator). */
  createAndConfirm(
    dto: CreateAndConfirmProcurementOrderDto,
    actorId: string,
  ): Promise<GarageProcurementOrderResponseDto> {
    const { lines, approverId, ...header } = dto;
    return this.saveAndConfirm(null, header, lines, approverId, actorId);
  }

  /** Cập nhật đơn nháp rồi gửi duyệt/ghi nhận trong một bước. */
  updateAndConfirm(
    id: string,
    dto: UpdateAndConfirmProcurementOrderDto,
    actorId: string,
  ): Promise<GarageProcurementOrderResponseDto> {
    const { lines, approverId, ...header } = dto;
    return this.saveAndConfirm(id, header, lines, approverId, actorId);
  }

  private async saveAndConfirm(
    id: string | null,
    header:
      | Omit<CreateProcurementOrderDto, 'lines'>
      | UpdateProcurementOrderHeaderDto,
    lines: CreateProcurementOrderDto['lines'],
    approverId: string | undefined,
    actorId: string,
  ): Promise<GarageProcurementOrderResponseDto> {
    if (approverId) {
      await this.approvers.assertEligible(
        ErpResource.GARAGE_PROCUREMENT_ORDERS,
        approverId,
        actorId,
      );
    }
    await this.assertBranchMatchesRequest(id, header);
    const saved = await this.flow.saveAndSubmit(
      id,
      { header, lines },
      { id: actorId, roles: await this.roles(actorId) },
      approverId ?? null,
    );
    return this.findOne(saved.id);
  }

  /** Đơn gắn đề nghị phải cùng chi nhánh với đề nghị (kiểm trước khi mở transaction). */
  private async assertBranchMatchesRequest(
    id: string | null,
    header: { requestId?: string; branchId?: string | null },
  ): Promise<void> {
    if (!id) {
      if (header.requestId) {
        await this.assertRequestSameBranch(header.requestId, header.branchId);
      }
      return;
    }
    if (header.branchId === undefined) return;
    const { header: current } = await this.query.findOne(id);
    if (current.requestId) {
      await this.assertRequestSameBranch(current.requestId, header.branchId);
    }
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
    const actors = await this.actors.resolve(events.map((e) => e.actorId));
    return events.map((e) => toApprovalEventResponse(e, actors.get(e.actorId)));
  }

  /**
   * Đơn mua và đề nghị mua nguồn phải cùng chi nhánh. Chi nhánh trống (null/undefined)
   * được coi là trống, nên hai bên cùng trống vẫn hợp lệ.
   */
  private async assertRequestSameBranch(
    requestId: string,
    branchId: string | null | undefined,
  ): Promise<void> {
    const request = await this.dataSource
      .getRepository(GarageProcurementRequest)
      .findOne({ where: { id: requestId } });
    if (!request) throw new NotFoundException('Không tìm thấy đề nghị mua');
    if ((request.branchId ?? null) !== (branchId ?? null)) {
      throw new BadRequestException(
        'Đơn mua phải cùng chi nhánh với đề nghị mua nguồn',
      );
    }
  }

  private roles(userId: string): Promise<string[]> {
    return this.rbac.getUserRoleNames(userId);
  }
}
