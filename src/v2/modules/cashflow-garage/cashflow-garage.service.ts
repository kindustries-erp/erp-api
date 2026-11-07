import { Injectable, NotFoundException } from '@nestjs/common';
import { ApprovalSettingsService } from '@/v2/core/approval-core/approval-settings.service';
import {
  CashflowForecastActor,
  CashflowForecastAction,
  defaultForecastApprovalEnabled,
  forecastApprovalDocType,
} from '@/v2/core/cashflow-core';
import { RbacCoreService } from '@/v2/core/rbac-core';
import {
  CreateGarageForecastDto,
  GarageForecastResponseDto,
  ListGarageForecastsQueryDto,
} from './dto/garage-forecast.dto';
import { GarageForecastCommandService } from './services/garage-forecast-command.service';
import { GarageForecastQueryService } from './services/garage-forecast-query.service';

const ACTION_MESSAGES: Record<CashflowForecastAction, string> = {
  submit: 'Đã gửi duyệt chứng từ',
  recall: 'Đã thu hồi chứng từ',
  approve: 'Đã duyệt chứng từ',
  reject: 'Đã từ chối chứng từ',
  cancel: 'Đã hủy chứng từ',
};

/**
 * Facade dự thu/dự chi Garage. Điều phối command/query, chỉ trả response DTO.
 * Chỉ xử lý bản ghi có ext Garage; bản ghi họ khác trả 404.
 */
@Injectable()
export class CashflowGarageService {
  constructor(
    private readonly command: GarageForecastCommandService,
    private readonly query: GarageForecastQueryService,
    private readonly rbac: RbacCoreService,
    private readonly approvals: ApprovalSettingsService,
  ) {}

  async list(query: ListGarageForecastsQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const result = await this.query.listGarage({
      direction: query.direction,
      kind: query.kind,
      status: query.status,
      branchId: query.branchId,
      page,
      limit: pageSize,
    });
    const exts = await this.query.findExtsByIds(
      result.items.map((item) => item.id),
    );
    return {
      items: result.items.map((item) =>
        GarageForecastResponseDto.fromEntity(item, exts.get(item.id) ?? null),
      ),
      total: result.total,
      page,
      pageSize,
      totalPages: Math.ceil(result.total / pageSize),
    };
  }

  async get(id: string) {
    return {
      message: 'Lấy chứng từ thành công',
      data: await this.load(id),
    };
  }

  async create(userId: string, dto: CreateGarageForecastDto) {
    const actor = await this.actor(userId);
    const docType = forecastApprovalDocType(dto.direction);
    const requiresApproval = await this.approvals.isEnabled(
      docType,
      defaultForecastApprovalEnabled(docType),
    );
    const header = await this.command.createForecast(actor, {
      requiresApproval,
      direction: dto.direction,
      kind: dto.kind,
      amount: dto.amount,
      plannedDate: dto.plannedDate ?? null,
      branchId: dto.branchId ?? null,
      partnerName: dto.partnerName ?? null,
      note: dto.note ?? null,
      caseId: dto.caseId ?? null,
      licensePlate: dto.licensePlate ?? null,
      paymentContent: dto.paymentContent ?? null,
      lines: dto.lines?.map((line) => ({
        itemName: line.itemName,
        lineType: line.lineType,
        qtyRequested: line.qtyRequested,
        unitPrice: line.unitPrice,
      })),
    });
    return {
      message: 'Tạo chứng từ thành công',
      data: await this.load(header.id),
    };
  }

  async transition(
    id: string,
    action: CashflowForecastAction,
    userId: string,
    reason?: string | null,
    approverId?: string | null,
  ) {
    await this.assertGarage(id);
    const actor = await this.actor(userId);
    await this.command.transition(id, action, actor, reason, { approverId });
    return {
      message: ACTION_MESSAGES[action],
      data: await this.load(id),
    };
  }

  private async load(id: string): Promise<GarageForecastResponseDto> {
    const header = await this.assertGarage(id);
    const ext = await this.query.findExt(id);
    const lines = await this.query.findLines(id);
    return GarageForecastResponseDto.fromEntity(header, ext, lines);
  }

  private async assertGarage(id: string) {
    const header = await this.query.findOne(id);
    const ext = await this.query.findExt(id);
    if (!ext) {
      throw new NotFoundException(`Không tìm thấy chứng từ ${id}`);
    }
    return header;
  }

  private async actor(userId: string): Promise<CashflowForecastActor> {
    return {
      id: userId,
      roles: await this.rbac.getUserRoleNames(userId),
    };
  }
}
