import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { CoreRbacGuard } from '../../auth/guards/core-rbac.guard';
import { RequireAnyPermissions } from '../../auth/decorators/require-permissions.decorator';
import { ErpResource, ErpAction } from '@/rbac-core/enums';
import { GarageCashflowService } from '../services/garage-cashflow.service';
import {
  CreateGarageCashflowDto,
  UpdateGarageCashflowDto,
} from '../dto/create-garage-cashflow.dto';
import {
  GarageCashflowColumnOptionsQueryDto,
  GarageCashflowQueryDto,
} from '../dto/garage-cashflow-query.dto';

@UseGuards(JwtAuthGuard, CoreRbacGuard)
@Controller('greenway/cashflow')
export class GarageCashflowController {
  constructor(private readonly cashflowService: GarageCashflowService) {}

  @Get()
  @RequireAnyPermissions(
    { resource: ErpResource.GARAGE, action: ErpAction.READ },
    { resource: ErpResource.CASH_STATEMENTS, action: ErpAction.READ },
    { resource: ErpResource.BANK_STATEMENTS, action: ErpAction.READ },
  )
  async listCashflow(@Query() query: GarageCashflowQueryDto) {
    return this.cashflowService.listCashflow(query);
  }

  @Get('column-options')
  @RequireAnyPermissions(
    { resource: ErpResource.GARAGE, action: ErpAction.READ },
    { resource: ErpResource.CASH_STATEMENTS, action: ErpAction.READ },
  )
  async getColumnOptions(@Query() query: GarageCashflowColumnOptionsQueryDto) {
    return this.cashflowService.getColumnOptions(query);
  }

  @Post()
  @RequireAnyPermissions(
    { resource: ErpResource.GARAGE, action: ErpAction.CREATE },
    { resource: ErpResource.GARAGE, action: ErpAction.UPDATE },
    { resource: ErpResource.CASH_STATEMENTS, action: ErpAction.CREATE },
  )
  async createCashflow(@Body() body: CreateGarageCashflowDto) {
    return this.cashflowService.createCashflow(body);
  }

  @Patch(':id')
  @RequireAnyPermissions(
    { resource: ErpResource.GARAGE, action: ErpAction.UPDATE },
    { resource: ErpResource.CASH_STATEMENTS, action: ErpAction.UPDATE },
  )
  async updateCashflow(
    @Param('id') id: string,
    @Body() body: UpdateGarageCashflowDto,
  ) {
    return this.cashflowService.updateCashflow(id, body);
  }

  @Delete(':id')
  @RequireAnyPermissions(
    { resource: ErpResource.GARAGE, action: ErpAction.DELETE },
    { resource: ErpResource.GARAGE, action: ErpAction.UPDATE },
    { resource: ErpResource.CASH_STATEMENTS, action: ErpAction.DELETE },
  )
  async deleteCashflow(@Param('id') id: string) {
    return this.cashflowService.deleteCashflow(id);
  }
}
