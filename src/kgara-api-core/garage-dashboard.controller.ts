import { Controller, Get, Query, UseGuards, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiQuery, ApiTags, ApiProduces } from '@nestjs/swagger';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CoreRbacGuard } from '../auth/guards/core-rbac.guard';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { GarageDashboardService } from './garage-dashboard.service';

@ApiTags('garage_dashboard')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, CoreRbacGuard)
@Controller('greenway/dashboard')
export class GarageDashboardController {
  constructor(private readonly service: GarageDashboardService) {}

  @RequirePermissions({ resource: 'garage', action: 'read' })
  @Get('stats')
  @ApiQuery({ name: 'date_from', required: false })
  @ApiQuery({ name: 'date_to', required: false })
  getDashboardStats(
    @Query('date_from') dateFrom?: string,
    @Query('date_to') dateTo?: string,
  ) {
    return this.service.getDashboardStats(dateFrom, dateTo);
  }

  @RequirePermissions({ resource: 'garage', action: 'read' })
  @Get('checkpoint-kpis')
  getCheckpointKpis() {
    return this.service.getCheckpointKpis();
  }

  @RequirePermissions({ resource: 'garage', action: 'read' })
  @Get('checkpoint-cases')
  @ApiQuery({ name: 'date_from', required: true })
  @ApiQuery({ name: 'date_to', required: true })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'pageSize', required: false })
  getCheckpointCases(
    @Query('date_from') dateFrom: string,
    @Query('date_to') dateTo: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.service.getCheckpointCases(
      dateFrom,
      dateTo,
      page ? parseInt(page, 10) : 1,
      pageSize ? parseInt(pageSize, 10) : 20,
    );
  }

  @RequirePermissions({ resource: 'garage', action: 'read' })
  @Get('customers')
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'pageSize', required: false })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'date_from', required: false })
  @ApiQuery({ name: 'date_to', required: false })
  @ApiQuery({ name: 'sortBy', required: false })
  @ApiQuery({ name: 'sortOrder', required: false })
  @ApiQuery({ name: 'column_search', required: false })
  @ApiQuery({ name: 'column_filters', required: false })
  getCustomersStats(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('search') search?: string,
    @Query('date_from') dateFrom?: string,
    @Query('date_to') dateTo?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: 'ASC' | 'DESC',
    @Query('column_search') columnSearch?: string,
    @Query('column_filters') columnFilters?: string,
  ) {
    return this.service.getCustomersStats(
      page ? parseInt(page, 10) : 1,
      pageSize ? parseInt(pageSize, 10) : 20,
      search,
      dateFrom,
      dateTo,
      sortBy,
      sortOrder,
      columnSearch,
      columnFilters,
    );
  }

  @RequirePermissions({ resource: 'garage', action: 'read' })
  @Get('export')
  @ApiProduces(
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  )
  @ApiQuery({ name: 'date_from', required: false })
  @ApiQuery({ name: 'date_to', required: false })
  async exportExcel(
    @Res() res: Response,
    @Query('date_from') dateFrom?: string,
    @Query('date_to') dateTo?: string,
  ) {
    const buffer = await this.service.exportExcel(dateFrom, dateTo);
    res.set({
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition':
        'attachment; filename="Garage_Dashboard_Report.xlsx"',
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }
}
