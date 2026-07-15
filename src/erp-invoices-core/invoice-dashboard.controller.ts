import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CoreRbacGuard } from '../auth/guards/core-rbac.guard';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { InvoiceDashboardService } from './invoice-dashboard.service';

@ApiTags('erp_invoices_dashboard')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, CoreRbacGuard)
@Controller('erp-invoices/dashboard')
export class InvoiceDashboardController {
  constructor(private readonly service: InvoiceDashboardService) {}

  @RequirePermissions({ resource: 'invoices', action: 'read' })
  @Get('stats')
  @ApiQuery({ name: 'date_from', required: false })
  @ApiQuery({ name: 'date_to', required: false })
  @ApiQuery({ name: 'branch_id', required: false })
  getDashboardStats(
    @Query('date_from') dateFrom?: string,
    @Query('date_to') dateTo?: string,
    @Query('branch_id') branchId?: string,
  ) {
    return this.service.getDashboardStats(dateFrom, dateTo, branchId);
  }

  @RequirePermissions({ resource: 'invoices', action: 'read' })
  @Get('partners')
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'pageSize', required: false })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'date_from', required: false })
  @ApiQuery({ name: 'date_to', required: false })
  @ApiQuery({ name: 'branch_id', required: false })
  getDashboardPartners(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('search') search?: string,
    @Query('date_from') dateFrom?: string,
    @Query('date_to') dateTo?: string,
    @Query('branch_id') branchId?: string,
  ) {
    return this.service.getDashboardPartners(
      page ? parseInt(page, 10) : 1,
      pageSize ? parseInt(pageSize, 10) : 20,
      search,
      dateFrom,
      dateTo,
      branchId,
    );
  }

  @RequirePermissions({ resource: 'invoices', action: 'read' })
  @Get('partners/:taxCode/stats')
  @ApiQuery({ name: 'date_from', required: false })
  @ApiQuery({ name: 'date_to', required: false })
  getPartnerStats(
    @Param('taxCode') taxCode: string,
    @Query('date_from') dateFrom?: string,
    @Query('date_to') dateTo?: string,
  ) {
    return this.service.getPartnerStats(taxCode, dateFrom, dateTo);
  }
}
