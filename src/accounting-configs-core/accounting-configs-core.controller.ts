import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
} from '@nestjs/common';
import { AccountingConfigsCoreService } from './accounting-configs-core.service';
import { CreateAccountingConfigsCoreDto } from './dto/create-accounting-configs-core.dto';
import { UpdateAccountingConfigsCoreDto } from './dto/update-accounting-configs-core.dto';
import { CoreRbacGuard } from '../auth/guards/core-rbac.guard';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('accounting-configs')
@UseGuards(JwtAuthGuard, CoreRbacGuard)
export class AccountingConfigsCoreController {
  constructor(
    private readonly accountingConfigsCoreService: AccountingConfigsCoreService,
  ) {}

  @Post()
  @RequirePermissions({ resource: 'accounting_configs', action: 'manage' })
  create(@Body() createDto: CreateAccountingConfigsCoreDto) {
    return this.accountingConfigsCoreService.create(createDto);
  }

  @Get()
  @RequirePermissions({ resource: 'accounting_configs', action: 'read' })
  findAll() {
    return this.accountingConfigsCoreService.findAll();
  }

  @Get(':id')
  @RequirePermissions({ resource: 'accounting_configs', action: 'manage' })
  findOne(@Param('id') id: string) {
    return this.accountingConfigsCoreService.findOne(id);
  }

  @Patch(':id')
  @RequirePermissions({ resource: 'accounting_configs', action: 'manage' })
  update(
    @Param('id') id: string,
    @Body() updateDto: UpdateAccountingConfigsCoreDto,
  ) {
    return this.accountingConfigsCoreService.update(id, updateDto);
  }

  @Delete(':id')
  @RequirePermissions({ resource: 'accounting_configs', action: 'manage' })
  remove(@Param('id') id: string) {
    return this.accountingConfigsCoreService.remove(id);
  }
}
