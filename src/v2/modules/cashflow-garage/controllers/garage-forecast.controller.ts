import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import { CoreRbacGuard } from '@/auth/guards/core-rbac.guard';
import { RequirePermissions } from '@/auth/decorators/require-permissions.decorator';
import { ErpAction, ErpResource } from '@/v2/core/rbac-core';
import { CashflowGarageService } from '../cashflow-garage.service';
import {
  CreateGarageForecastDto,
  GarageForecastReasonDto,
  ListGarageForecastsQueryDto,
  SubmitGarageForecastDto,
} from '../dto/garage-forecast.dto';

interface RequestWithUser {
  user?: { sub?: string };
}

/** Dự thu/dự chi Garage. Hành động duyệt tách route để kiểm quyền đúng từng hành động. */
@ApiTags('cashflow_garage')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, CoreRbacGuard)
@Controller('api/v2/cashflow-garage/forecasts')
export class CashflowGarageController {
  constructor(private readonly service: CashflowGarageService) {}

  @Get()
  @RequirePermissions({
    resource: ErpResource.GARAGE_CASHFLOW,
    action: ErpAction.READ,
  })
  @ApiOperation({ summary: 'Danh sách dự thu/dự chi Garage' })
  list(@Query() query: ListGarageForecastsQueryDto) {
    return this.service.list(query);
  }

  @Get(':id')
  @RequirePermissions({
    resource: ErpResource.GARAGE_CASHFLOW,
    action: ErpAction.READ,
  })
  @ApiOperation({ summary: 'Chi tiết dự thu/dự chi Garage kèm dòng hàng' })
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.get(id);
  }

  @Post()
  @RequirePermissions({
    resource: ErpResource.GARAGE_CASHFLOW,
    action: ErpAction.CREATE,
  })
  @ApiOperation({
    summary: 'Tạo dự thu/dự chi Garage (dự chi mua hàng kèm dòng hàng)',
  })
  create(@Body() dto: CreateGarageForecastDto, @Req() req: RequestWithUser) {
    return this.service.create(req.user?.sub ?? '', dto);
  }

  @Post(':id/submit')
  @RequirePermissions({
    resource: ErpResource.GARAGE_CASHFLOW,
    action: ErpAction.UPDATE,
  })
  submit(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: SubmitGarageForecastDto,
    @Req() req: RequestWithUser,
  ) {
    return this.service.transition(
      id,
      'submit',
      req.user?.sub ?? '',
      null,
      body.approverId,
    );
  }

  @Post(':id/recall')
  @RequirePermissions({
    resource: ErpResource.GARAGE_CASHFLOW,
    action: ErpAction.UPDATE,
  })
  recall(@Param('id', ParseUUIDPipe) id: string, @Req() req: RequestWithUser) {
    return this.service.transition(id, 'recall', req.user?.sub ?? '');
  }

  @Post(':id/approve')
  @RequirePermissions({
    resource: ErpResource.GARAGE_CASHFLOW,
    action: ErpAction.APPROVE,
  })
  approve(@Param('id', ParseUUIDPipe) id: string, @Req() req: RequestWithUser) {
    return this.service.transition(id, 'approve', req.user?.sub ?? '');
  }

  @Post(':id/reject')
  @RequirePermissions({
    resource: ErpResource.GARAGE_CASHFLOW,
    action: ErpAction.REJECT,
  })
  reject(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: GarageForecastReasonDto,
    @Req() req: RequestWithUser,
  ) {
    return this.service.transition(
      id,
      'reject',
      req.user?.sub ?? '',
      body.reason,
    );
  }

  @Post(':id/cancel')
  @RequirePermissions({
    resource: ErpResource.GARAGE_CASHFLOW,
    action: ErpAction.DELETE,
  })
  cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: GarageForecastReasonDto,
    @Req() req: RequestWithUser,
  ) {
    return this.service.transition(
      id,
      'cancel',
      req.user?.sub ?? '',
      body.reason,
    );
  }
}
