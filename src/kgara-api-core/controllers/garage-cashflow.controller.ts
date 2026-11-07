import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Query,
  Param,
  Body,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { CoreRbacGuard } from '../../auth/guards/core-rbac.guard';
import {
  RequirePermissions,
  RequireAnyPermissions,
} from '../../auth/decorators/require-permissions.decorator';
import { ErpResource, ErpAction } from '@/v2/core/rbac-core';
import { GarageCashflowService } from '../services/garage-cashflow.service';
import { GaragePnlService } from '../services/garage-pnl.service';
import { isNewCashflowSource } from '@/v2/modules/cashflow-garage/cashflow-garage-source';
import { LegacyVoucherListService } from '@/v2/modules/cashflow-garage/compat/legacy-voucher-list.service';
import { LegacyVoucherDashboardService } from '@/v2/modules/cashflow-garage/compat/legacy-voucher-dashboard.service';
import { LegacyVoucherOptionsService } from '@/v2/modules/cashflow-garage/compat/legacy-voucher-options.service';
import { LegacyVoucherDuplicateService } from '@/v2/modules/cashflow-garage/compat/legacy-voucher-duplicate.service';
import { LegacyVoucherWriteService } from '@/v2/modules/cashflow-garage/compat/legacy-voucher-write.service';
import {
  CreateKgaraCashflowVoucherDto,
  UpdateKgaraCashflowVoucherDto,
  ListKgaraCashflowVoucherQueryDto,
  KgaraCashflowVoucherResponseDto,
  ListKgaraCashflowVouchersResponseDto,
  CheckKgaraCashflowDuplicateQueryDto,
  KgaraCashflowDuplicateResponseDto,
  GarageCashflowDashboardQueryDto,
  GarageCashflowDashboardResponseDto,
} from '../dto/garage-cashflow.dto';

@ApiTags('greenway_cashflow')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, CoreRbacGuard)
@Controller('greenway/cashflow-vouchers')
export class GarageCashflowController {
  constructor(
    private readonly cashflowService: GarageCashflowService,
    private readonly pnlService?: GaragePnlService,
    private readonly newList?: LegacyVoucherListService,
    private readonly newDashboard?: LegacyVoucherDashboardService,
    private readonly newOptions?: LegacyVoucherOptionsService,
    private readonly newDuplicates?: LegacyVoucherDuplicateService,
    private readonly newWrite?: LegacyVoucherWriteService,
  ) {}

  /** Đọc lại phiếu vừa ghi theo hình dạng cũ (để trả về cùng response như trước). */
  private async reloadVoucher(
    id: string,
    code: string,
  ): Promise<KgaraCashflowVoucherResponseDto> {
    const page = await this.newList?.list({
      column_search: JSON.stringify({ voucherCode: code }),
      tab: 'all',
      pageSize: 5,
    });
    const row = (page?.data ?? []).find((r: { id?: string }) => r.id === id);
    return (row ?? {
      id,
      voucherCode: code,
    }) as KgaraCashflowVoucherResponseDto;
  }

  @Post('sync-pnl-commissions')
  @RequireAnyPermissions(
    { resource: ErpResource.GARAGE_CASHFLOW, action: ErpAction.CREATE },
    { resource: ErpResource.GARAGE_CASHFLOW, action: ErpAction.UPDATE },
  )
  async syncPnlCommissions(
    @Query('year') year?: number,
    @Query('month') month?: number,
  ) {
    const currentYear = year ? Number(year) : new Date().getFullYear();
    const currentMonth = month ? Number(month) : new Date().getMonth() + 1;
    if (this.pnlService) {
      return this.pnlService.syncCommissionVouchers(currentYear, currentMonth);
    }
    return { message: 'PnlService not injected' };
  }

  @Get()
  @RequirePermissions({
    resource: ErpResource.GARAGE_CASHFLOW,
    action: ErpAction.READ,
  })
  async listVouchers(
    @Query() query: ListKgaraCashflowVoucherQueryDto,
  ): Promise<ListKgaraCashflowVouchersResponseDto> {
    if (isNewCashflowSource() && this.newList) {
      return this.newList.list(query as never) as never;
    }
    return this.cashflowService.listVouchers(query);
  }

  @Get('dashboard')
  @RequirePermissions({
    resource: ErpResource.GARAGE_CASHFLOW,
    action: ErpAction.READ,
  })
  async getDashboard(
    @Query() query: GarageCashflowDashboardQueryDto,
  ): Promise<GarageCashflowDashboardResponseDto> {
    if (isNewCashflowSource() && this.newDashboard) {
      return this.newDashboard.getDashboardStats(query);
    }
    return this.cashflowService.getDashboardStats(query);
  }

  @Get('column-options')
  @RequirePermissions({
    resource: ErpResource.GARAGE_CASHFLOW,
    action: ErpAction.READ,
  })
  async getColumnOptions(
    @Query('column') column: string,
    @Query('search') search: string,
    @Query('page') page: number,
    @Query('pageSize') pageSize: number,
    @Query('column_filters') column_filters: string,
    @Query('tab') tab?: string,
  ) {
    if (isNewCashflowSource() && this.newOptions) {
      return this.newOptions.getColumnOptions(
        column,
        search,
        page,
        pageSize,
        column_filters,
        tab,
      );
    }
    return this.cashflowService.getColumnOptions(
      column,
      search,
      page,
      pageSize,
      column_filters,
      tab,
    );
  }

  @Get('duplicate-check')
  @RequireAnyPermissions(
    { resource: ErpResource.GARAGE_CASHFLOW, action: ErpAction.CREATE },
    { resource: ErpResource.GARAGE_CASHFLOW, action: ErpAction.UPDATE },
  )
  async checkDuplicates(
    @Query() query: CheckKgaraCashflowDuplicateQueryDto,
  ): Promise<KgaraCashflowDuplicateResponseDto> {
    if (isNewCashflowSource() && this.newDuplicates) {
      return this.newDuplicates.findPotentialDuplicates(query) as never;
    }
    return this.cashflowService.findPotentialDuplicates(query);
  }

  @Post()
  @RequirePermissions({
    resource: ErpResource.GARAGE_CASHFLOW,
    action: ErpAction.CREATE,
  })
  async createVoucher(
    @Body() dto: CreateKgaraCashflowVoucherDto,
    @Req() req?: any,
  ): Promise<KgaraCashflowVoucherResponseDto> {
    if (isNewCashflowSource() && this.newWrite) {
      const created = await this.newWrite.createVoucher(dto, req?.user);
      return this.reloadVoucher(created.id, created.code);
    }
    return this.cashflowService.createVoucher(dto, req?.user);
  }

  @Put(':id')
  @RequirePermissions({
    resource: ErpResource.GARAGE_CASHFLOW,
    action: ErpAction.UPDATE,
  })
  async updateVoucher(
    @Param('id') id: string,
    @Body() dto: UpdateKgaraCashflowVoucherDto,
    @Req() req?: any,
  ): Promise<KgaraCashflowVoucherResponseDto> {
    if (isNewCashflowSource() && this.newWrite) {
      const updated = await this.newWrite.updateVoucher(id, dto, req?.user);
      return this.reloadVoucher(updated.id, updated.code);
    }
    return this.cashflowService.updateVoucher(id, dto, req?.user);
  }

  @Delete(':id')
  @RequirePermissions({
    resource: ErpResource.GARAGE_CASHFLOW,
    action: ErpAction.DELETE,
  })
  async deleteVoucher(
    @Param('id') id: string,
    @Req() req?: any,
  ): Promise<void> {
    if (isNewCashflowSource() && this.newWrite) {
      return this.newWrite.deleteVoucher(id);
    }
    return this.cashflowService.deleteVoucher(id, req?.user);
  }
}
