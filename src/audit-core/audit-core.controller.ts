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

  @Get('column-options')
  async getColumnOptions(
    @Query('column') column: string,
    @Query('search') search?: string,
    @Query('page') page: string = '1',
    @Query('pageSize') pageSize: string = '20',
    @Query('filters') filters?: string,
  ) {
    return this.auditCoreService.getColumnOptions(
      column,
      search,
      parseInt(page, 10) || 1,
      parseInt(pageSize, 10) || 20,
      filters,
    );
  }

  @Get(':entityType/:entityId/timeline')
  getEntityTimeline(
    @Param('entityType') entityType: string,
    @Param('entityId') entityId: string,
  ) {
    return this.auditCoreService.getEntityTimeline(entityType, entityId);
  }
}
