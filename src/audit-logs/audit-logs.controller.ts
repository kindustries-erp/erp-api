import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { DirectusAuthGuard } from '../auth/guards/directus-auth.guard';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { AuditLogsService } from './audit-logs.service';
import { AuditLogQueryDto } from './dto/audit-log-query.dto';

@ApiTags('AuditLogs')
@ApiBearerAuth()
@UseGuards(DirectusAuthGuard)
@Controller('audit-logs')
export class AuditLogsController {
  constructor(private readonly auditLogsService: AuditLogsService) {}

  @RequirePermissions({ resource: 'activity_logs', action: 'read' })
  @Get()
  findAll(@Query() query: AuditLogQueryDto) {
    return this.auditLogsService.findAll(query);
  }

  @RequirePermissions({ resource: 'activity_logs', action: 'read' })
  @Get('payment-vouchers/:id/timeline')
  getPaymentVoucherTimeline(@Param('id') id: string) {
    return this.auditLogsService.getPaymentVoucherTimeline(id);
  }
}
