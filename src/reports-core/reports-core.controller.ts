import { Controller, Get, Query, UseGuards, Res } from '@nestjs/common';
import { ReportsCoreService } from './reports-core.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { Response } from 'express';

@UseGuards(JwtAuthGuard)
@Controller('reports')
export class ReportsCoreController {
  constructor(private readonly reportsCoreService: ReportsCoreService) {}

  @Get('vinfast-parts')
  async getVinfastPartsTracking(
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('search') search?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortDir') sortDir?: string,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '50',
  ) {
    const result = await this.reportsCoreService.getVinfastPartsTracking({
      dateFrom,
      dateTo,
      search,
      sortBy,
      sortDir,
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
    });
    return result;
  }

  @Get('vinfast-parts/details')
  async getVinfastPartsTrackingDetails(
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('search') search?: string,
    @Query('itemCode') itemCode?: string,
  ) {
    return await this.reportsCoreService.getVinfastPartsTrackingDetails({
      dateFrom,
      dateTo,
      search,
      itemCode,
    });
  }

  @Get('vinfast-parts/export/excel')
  async exportVinfastPartsTrackingExcel(
    @Query('dateFrom') dateFrom: string,
    @Query('dateTo') dateTo: string,
    @Query('search') search: string,
    @Res() res: Response,
  ) {
    const buffer =
      await this.reportsCoreService.exportVinfastPartsTrackingExcel({
        dateFrom,
        dateTo,
        search,
      });
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename=bang_ke_phu_tung_vinfast.xlsx',
    );
    res.send(buffer);
  }
}
