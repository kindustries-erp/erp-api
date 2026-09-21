import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Request,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import type { Response } from 'express';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { CoreRbacGuard } from '../../auth/guards/core-rbac.guard';
import { RequireAnyPermissions } from '../../auth/decorators/require-permissions.decorator';
import { ErpResource, ErpAction } from '@/rbac-core/enums';
import { InvoiceDebtsService } from '../services/invoice-debts.service';
import { InvoiceDebtsExportBackgroundService } from '../services/invoice-debts-export-background.service';
import {
  GetInvoiceDebtsQueryDto,
  GetInvoiceDebtColumnOptionsQueryDto,
  InvoicePartnerType,
} from '../dto/get-invoice-debts.dto';

@ApiTags('erp_invoices_debts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, CoreRbacGuard)
@Controller('erp-invoices/debts')
export class InvoiceDebtsController {
  constructor(
    private readonly service: InvoiceDebtsService,
    private readonly backgroundExportService: InvoiceDebtsExportBackgroundService,
  ) {}

  @RequireAnyPermissions(
    { resource: ErpResource.INVOICE_DEBTS, action: ErpAction.READ },
    { resource: ErpResource.INVOICES, action: ErpAction.READ },
  )
  @Get()
  @ApiOperation({
    summary: 'Lấy danh sách tổng hợp công nợ Khách hàng / Nhà cung cấp',
  })
  getDebts(@Query() query: GetInvoiceDebtsQueryDto) {
    return this.service.getDebts(query);
  }

  @RequireAnyPermissions(
    { resource: ErpResource.INVOICE_DEBTS, action: ErpAction.READ },
    { resource: ErpResource.INVOICES, action: ErpAction.READ },
  )
  @Get('column-options')
  @ApiOperation({
    summary: 'Lấy danh sách options cho bộ lọc Header Filter theo cột',
  })
  getColumnOptions(@Query() query: GetInvoiceDebtColumnOptionsQueryDto) {
    return this.service.getColumnOptions(query);
  }

  @RequireAnyPermissions(
    { resource: ErpResource.INVOICE_DEBTS, action: ErpAction.READ },
    { resource: ErpResource.INVOICES, action: ErpAction.READ },
  )
  @Get('export/excel')
  @ApiOperation({
    summary: 'Xuất file Excel báo cáo công nợ đồng bộ trực tiếp',
  })
  async exportExcel(
    @Query() query: GetInvoiceDebtsQueryDto,
    @Res() res: Response,
  ) {
    const buffer = await this.service.exportDebtsExcel(query);
    const isSupplier = query.partner_type === InvoicePartnerType.SUPPLIER;
    const fileName = `Bao_cao_cong_no_${isSupplier ? 'nha_cung_cap' : 'khach_hang'}_${new Date().toISOString().slice(0, 10)}.xlsx`;

    res.set({
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }

  @RequireAnyPermissions(
    { resource: ErpResource.INVOICE_DEBTS, action: ErpAction.READ },
    { resource: ErpResource.INVOICES, action: ErpAction.READ },
  )
  @Post('export/excel/background')
  @ApiOperation({
    summary: 'Khởi chạy tiến trình xuất Excel công nợ nền',
  })
  async startExportExcelBackground(
    @Body() query: GetInvoiceDebtsQueryDto,
    @Request() req: any,
  ) {
    const userId = req.user?.id || req.user?.userId || 'anonymous';
    return this.backgroundExportService.startBackgroundExport(query, userId);
  }

  @RequireAnyPermissions(
    { resource: ErpResource.INVOICE_DEBTS, action: ErpAction.READ },
    { resource: ErpResource.INVOICES, action: ErpAction.READ },
  )
  @Get('export/excel/background/history')
  @ApiOperation({
    summary: 'Lấy lịch sử các tác vụ xuất Excel công nợ nền của người dùng',
  })
  getExportExcelBackgroundHistory(
    @Request() req: any,
    @Query('page') page?: number,
    @Query('pageSize') pageSize?: number,
  ) {
    const userId = req.user?.id || req.user?.userId || 'anonymous';
    return this.backgroundExportService.listHistoryForUser(
      userId,
      Number(page) || 1,
      Number(pageSize) || 10,
    );
  }

  @RequireAnyPermissions(
    { resource: ErpResource.INVOICE_DEBTS, action: ErpAction.READ },
    { resource: ErpResource.INVOICES, action: ErpAction.READ },
  )
  @Get('export/excel/background/:jobId/download')
  @ApiOperation({
    summary: 'Tải về file kết quả xuất Excel công nợ nền theo Job ID',
  })
  getExportExcelBackgroundDownload(
    @Param('jobId') jobId: string,
    @Request() req: any,
    @Res() res: Response,
  ) {
    const userId = req.user?.id || req.user?.userId || 'anonymous';
    const { buffer, fileName } =
      this.backgroundExportService.getReadyExportFile(jobId, userId);

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${encodeURIComponent(fileName)}"`,
    );
    res.setHeader('Content-Length', buffer.length);
    res.end(buffer);
  }

  @RequireAnyPermissions(
    { resource: ErpResource.INVOICE_DEBTS, action: ErpAction.READ },
    { resource: ErpResource.INVOICES, action: ErpAction.READ },
  )
  @Get(':taxCode/invoices')
  @ApiOperation({
    summary: 'Lấy danh sách chi tiết các hóa đơn của một đối tác',
  })
  getPartnerInvoices(
    @Param('taxCode') taxCode: string,
    @Query('partner_type') partnerType?: InvoicePartnerType,
    @Query('date_from') dateFrom?: string,
    @Query('date_to') dateTo?: string,
    @Query('partner_name') partnerName?: string,
  ) {
    return this.service.getPartnerInvoices(
      taxCode,
      partnerType,
      dateFrom,
      dateTo,
      partnerName,
    );
  }
}
