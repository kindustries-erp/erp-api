import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import { AuditLogsV2Service } from '../audit-logs-v2.service';
import { QueryAuditLogDto } from '../dto/query-audit-log.dto';
import { QueryAuditLogColumnOptionsDto } from '../dto/query-audit-log-column-options.dto';

/**
 * Nhật ký kiểm toán v2. Giữ hành vi V1: chỉ `JwtAuthGuard`, mọi người dùng đăng nhập đều xem được
 * (chưa siết RBAC, xem skill `audit-core`). Route tĩnh `column-options` khai báo trước route có tham số.
 */
@ApiTags('audit_logs_v2')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api/v2/audit-logs')
export class AuditLogController {
  constructor(private readonly service: AuditLogsV2Service) {}

  @Get()
  @ApiOperation({ summary: 'Danh sách nhật ký (phân trang, lọc, sắp xếp)' })
  list(@Query() query: QueryAuditLogDto) {
    return this.service.list(query);
  }

  @Get('column-options')
  @ApiOperation({ summary: 'Gợi ý giá trị cho bộ lọc cột' })
  columnOptions(@Query() query: QueryAuditLogColumnOptionsDto) {
    return this.service.columnOptions(query);
  }

  @Get(':entityType/:entityId/timeline')
  @ApiOperation({ summary: 'Lịch sử thay đổi của một thực thể (cũ đến mới)' })
  timeline(
    @Param('entityType') entityType: string,
    @Param('entityId') entityId: string,
  ) {
    return this.service.timeline(entityType, entityId);
  }
}
