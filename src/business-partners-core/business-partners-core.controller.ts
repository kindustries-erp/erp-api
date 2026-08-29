import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CoreRbacGuard } from '../auth/guards/core-rbac.guard';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { BusinessPartnersCoreService } from './business-partners-core.service';
import { PaginationDto } from '../common/dto/pagination.dto';
import { CreateBusinessPartnerDto } from './dto/create-business-partner.dto';
import { UpdateBusinessPartnerDto } from './dto/update-business-partner.dto';

@ApiTags('erp_business_partners')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, CoreRbacGuard)
@Controller('business-partners')
export class BusinessPartnersCoreController {
  constructor(private readonly service: BusinessPartnersCoreService) {}

  @RequirePermissions({ resource: 'business_partners', action: 'create' })
  @Post()
  create(@Body() dto: CreateBusinessPartnerDto) {
    return this.service.create(dto);
  }

  @RequirePermissions({ resource: 'business_partners', action: 'read' })
  @Get()
  findAll(@Query() query: PaginationDto) {
    return this.service.findAll(query);
  }

  @RequirePermissions({ resource: 'business_partners', action: 'read' })
  @Get('column-options')
  async getColumnOptions(
    @Query('column') column: string,
    @Query('search') search?: string,
    @Query('page') page: string = '1',
    @Query('pageSize') pageSize: string = '20',
    @Query('filters') filters?: string,
    @Query('partnerType') partnerType?: string,
  ) {
    return this.service.getColumnOptions(
      column,
      search,
      parseInt(page, 10) || 1,
      parseInt(pageSize, 10) || 20,
      filters,
      partnerType,
    );
  }

  @RequirePermissions({ resource: 'business_partners', action: 'read' })
  @Get(':id')
  findOne(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.findOne(id);
  }

  @RequirePermissions({ resource: 'business_partners', action: 'update' })
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateBusinessPartnerDto) {
    return this.service.update(id, dto);
  }

  @RequirePermissions({ resource: 'business_partners', action: 'delete' })
  @Delete(':id')
  remove(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.remove(id);
  }
}
