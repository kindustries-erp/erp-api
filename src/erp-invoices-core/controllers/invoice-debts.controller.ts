import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { CoreRbacGuard } from '../../auth/guards/core-rbac.guard';
import { RequireAnyPermissions } from '../../auth/decorators/require-permissions.decorator';
import { ErpResource, ErpAction } from '@/rbac-core/enums';
import { InvoiceDebtsService } from '../services/invoice-debts.service';
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
  constructor(private readonly service: InvoiceDebtsService) {}

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
