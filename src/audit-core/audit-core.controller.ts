import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuditCoreService } from './audit-core.service';
import { AuditLogCoreQueryDto } from './dto/audit-log-core-query.dto';

@ApiTags('audit-logs-core')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('audit-logs-core')
export class AuditCoreController {
  constructor(private readonly auditCoreService: AuditCoreService) {}

  @Get()
  findAll(@Query() query: AuditLogCoreQueryDto) {
    return this.auditCoreService.findAll(query);
  }

  @Get(':entityType/:entityId/timeline')
  getEntityTimeline(
    @Param('entityType') entityType: string,
    @Param('entityId') entityId: string,
  ) {
    return this.auditCoreService.getEntityTimeline(entityType, entityId);
  }
}
