import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CoreRbacGuard } from '../auth/guards/core-rbac.guard';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { ChartOfAccountsService } from './chart-of-accounts.service';
import { CreateChartOfAccountDto } from './dto/create-chart-of-account.dto';
import { UpdateChartOfAccountDto } from './dto/update-chart-of-account.dto';

@ApiTags('Chart Of Accounts')
@ApiBearerAuth()
@Controller('chart-of-accounts')
@UseGuards(JwtAuthGuard, CoreRbacGuard)
export class ChartOfAccountsController {
  constructor(
    private readonly chartOfAccountsService: ChartOfAccountsService,
  ) {}

  @Post()
  @RequirePermissions({ resource: 'accounting_configs', action: 'manage' })
  create(@Body() dto: CreateChartOfAccountDto) {
    return this.chartOfAccountsService.create(dto);
  }

  @Get()
  @RequirePermissions({ resource: 'accounting_configs', action: 'read' })
  findAll(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('search') search?: string,
    @Query('sort') sort?: string,
  ) {
    return this.chartOfAccountsService.findAll({
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
      search,
      sort,
    });
  }

  @Get('lookup')
  @RequirePermissions({ resource: 'accounting_configs', action: 'read' })
  lookup(@Query('search') search?: string) {
    return this.chartOfAccountsService.findForLookup(search);
  }

  @Get(':id')
  @RequirePermissions({ resource: 'accounting_configs', action: 'manage' })
  findOne(@Param('id') id: string) {
    return this.chartOfAccountsService.findOne(id);
  }

  @Patch(':id')
  @RequirePermissions({ resource: 'accounting_configs', action: 'manage' })
  update(@Param('id') id: string, @Body() dto: UpdateChartOfAccountDto) {
    return this.chartOfAccountsService.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions({ resource: 'accounting_configs', action: 'manage' })
  remove(@Param('id') id: string) {
    return this.chartOfAccountsService.remove(id);
  }
}
