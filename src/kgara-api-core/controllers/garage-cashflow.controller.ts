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
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { CoreRbacGuard } from '../../auth/guards/core-rbac.guard';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { ErpResource, ErpAction } from '@/rbac-core/enums';
import { GarageCashflowService } from '../services/garage-cashflow.service';
import {
  CreateKgaraCashflowVoucherDto,
  UpdateKgaraCashflowVoucherDto,
  ListKgaraCashflowVoucherQueryDto,
} from '../dto/garage-cashflow.dto';

@ApiTags('greenway_cashflow')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, CoreRbacGuard)
@Controller('greenway/cashflow-vouchers')
export class GarageCashflowController {
  constructor(private readonly cashflowService: GarageCashflowService) {}

  @Get()
  @RequirePermissions({ resource: ErpResource.GARAGE, action: ErpAction.READ })
  async listVouchers(@Query() query: ListKgaraCashflowVoucherQueryDto) {
    return this.cashflowService.listVouchers(query);
  }

  @Get('dashboard')
  @RequirePermissions({ resource: ErpResource.GARAGE, action: ErpAction.READ })
  async getDashboard() {
    return this.cashflowService.getDashboardStats();
  }

  @Get('column-options')
  @RequirePermissions({ resource: ErpResource.GARAGE, action: ErpAction.READ })
  async getColumnOptions(
    @Query('column') column: string,
    @Query('search') search: string,
    @Query('page') page: number,
    @Query('pageSize') pageSize: number,
    @Query('column_filters') column_filters: string,
  ) {
    return this.cashflowService.getColumnOptions(
      column,
      search,
      page,
      pageSize,
      column_filters,
    );
  }

  @Post()
  @RequirePermissions({
    resource: ErpResource.GARAGE,
    action: ErpAction.CREATE,
  })
  async createVoucher(@Body() dto: CreateKgaraCashflowVoucherDto) {
    return this.cashflowService.createVoucher(dto);
  }

  @Put(':id')
  @RequirePermissions({
    resource: ErpResource.GARAGE,
    action: ErpAction.UPDATE,
  })
  async updateVoucher(
    @Param('id') id: string,
    @Body() dto: UpdateKgaraCashflowVoucherDto,
  ) {
    return this.cashflowService.updateVoucher(id, dto);
  }

  @Delete(':id')
  @RequirePermissions({
    resource: ErpResource.GARAGE,
    action: ErpAction.DELETE,
  })
  async deleteVoucher(@Param('id') id: string) {
    return this.cashflowService.deleteVoucher(id);
  }
}
