import { Injectable } from '@nestjs/common';
import { toPagedList } from '@/common/utils/paginated-result';
import { QueryAuditLogDto } from './dto/query-audit-log.dto';
import { QueryAuditLogColumnOptionsDto } from './dto/query-audit-log-column-options.dto';
import {
  AuditLogListResponseDto,
  AuditLogTimelineResponseDto,
} from './dto/audit-log-response.dto';
import { ColumnOptionsResponseDto } from '@/common/dto/column-options-response.dto';
import { toAuditLogResponse } from './helpers/audit-log.mapper';
import { AuditLogQueryService } from './services/audit-log-query.service';

/** Facade đọc nhật ký: luôn trả response DTO, danh sách theo chuẩn v2 `{ items, pagination }`. */
@Injectable()
export class AuditLogsV2Service {
  constructor(private readonly query: AuditLogQueryService) {}

  async list(dto: QueryAuditLogDto): Promise<AuditLogListResponseDto> {
    const { rows, total, page, pageSize } = await this.query.findPage(dto);
    return toPagedList(rows.map(toAuditLogResponse), page, pageSize, total);
  }

  async columnOptions(
    dto: QueryAuditLogColumnOptionsDto,
  ): Promise<ColumnOptionsResponseDto> {
    const { items, total, page, pageSize } =
      await this.query.findColumnOptions(dto);
    return toPagedList(items, page, pageSize, total);
  }

  async timeline(
    entityType: string,
    entityId: string,
  ): Promise<AuditLogTimelineResponseDto> {
    const rows = await this.query.findTimeline(entityType, entityId);
    return { items: rows.map(toAuditLogResponse) };
  }
}
