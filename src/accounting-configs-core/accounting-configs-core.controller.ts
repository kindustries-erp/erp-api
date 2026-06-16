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
import { PermissionsGuard } from '../rbac-core/guards/permissions.guard';
import { Permissions } from '../rbac-core/decorators/permissions.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('accounting-configs')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AccountingConfigsCoreController {
  constructor(
    private readonly accountingConfigsCoreService: AccountingConfigsCoreService,
  ) {}

  @Post()
  @Permissions('manage:accounting_configs')
  create(@Body() createDto: CreateAccountingConfigsCoreDto) {
    return this.accountingConfigsCoreService.create(createDto);
  }

  @Get()
  @Permissions('manage:accounting_configs', 'read:journal_entries')
  findAll() {
    return this.accountingConfigsCoreService.findAll();
  }

  @Get(':id')
  @Permissions('manage:accounting_configs')
  findOne(@Param('id') id: string) {
    return this.accountingConfigsCoreService.findOne(id);
  }

  @Patch(':id')
  @Permissions('manage:accounting_configs')
  update(
    @Param('id') id: string,
    @Body() updateDto: UpdateAccountingConfigsCoreDto,
  ) {
    return this.accountingConfigsCoreService.update(id, updateDto);
  }

  @Delete(':id')
  @Permissions('manage:accounting_configs')
  remove(@Param('id') id: string) {
    return this.accountingConfigsCoreService.remove(id);
  }
}
