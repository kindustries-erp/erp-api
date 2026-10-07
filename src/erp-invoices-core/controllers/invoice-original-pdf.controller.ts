import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { CoreRbacGuard } from '../../auth/guards/core-rbac.guard';
import { RequireAnyPermissions } from '../../auth/decorators/require-permissions.decorator';
import { ErpResource, ErpAction } from '@/rbac-core/enums';
import { InvoiceOriginalPdfFacade } from '../services/original-pdf/invoice-original-pdf.facade';
import { SyncAdvancedInvoiceDto } from '../dto/sync-advanced-invoice.dto';
import {
  OriginalPdfDownloadResponseDto,
  OriginalPdfLookupInfoResponseDto,
  SyncAdvancedResponseDto,
} from '../dto/original-pdf-response.dto';

@ApiTags('erp_invoices_original_pdf')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, CoreRbacGuard)
@Controller('erp-invoices/original-pdf')
export class InvoiceOriginalPdfController {
  constructor(private readonly facade: InvoiceOriginalPdfFacade) {}

  @RequireAnyPermissions(
    { resource: ErpResource.INVOICES, action: ErpAction.UPDATE },
    { resource: ErpResource.INVOICES, action: ErpAction.CREATE },
  )
  @Post('sync-advanced')
  @ApiOperation({
    summary: 'Kích hoạt phiên đồng bộ nâng cao và tải PDF gốc hàng loạt',
  })
  async startSyncAdvanced(
    @Body() dto: SyncAdvancedInvoiceDto,
    @Request() req: any,
  ): Promise<SyncAdvancedResponseDto> {
    const userId = req.user?.id || req.user?.userId;
    return this.facade.startAdvancedSync(dto, userId);
  }

  @RequireAnyPermissions({
    resource: ErpResource.INVOICES,
    action: ErpAction.UPDATE,
  })
  @Post(':id/download')
  @ApiOperation({
    summary: 'Tải tệp PDF gốc chính thức từ nhà cung cấp cho 1 hóa đơn',
  })
  async downloadForInvoice(
    @Param('id') id: string,
  ): Promise<OriginalPdfDownloadResponseDto> {
    return this.facade.downloadForInvoice(id);
  }

  @RequireAnyPermissions({
    resource: ErpResource.INVOICES,
    action: ErpAction.READ,
  })
  @Get(':id/lookup-info')
  @ApiOperation({
    summary:
      'Lấy thông tin nhà cung cấp, mã tra cứu và liên kết portal của hóa đơn',
  })
  async getLookupInfo(
    @Param('id') id: string,
  ): Promise<OriginalPdfLookupInfoResponseDto> {
    return this.facade.getLookupInfo(id);
  }

  @RequireAnyPermissions({
    resource: ErpResource.INVOICES,
    action: ErpAction.READ,
  })
  @Get('sync-status/:syncId')
  @ApiOperation({
    summary: 'Kiểm tra trạng thái tiến trình tải PDF gốc của phiên đồng bộ',
  })
  async getSyncStatus(@Param('syncId') syncId: string): Promise<{
    id: string;
    status: string;
    totalFound: number;
    totalPdfSuccess: number;
    totalPdfFailed: number;
    errorMessage: string | null;
  }> {
    const sync = await this.facade.getSyncStatus(syncId);
    return {
      id: sync.id,
      status: sync.status,
      totalFound: sync.totalFound,
      totalPdfSuccess: sync.totalPdfSuccess,
      totalPdfFailed: sync.totalPdfFailed,
      errorMessage: sync.errorMessage,
    };
  }
}
