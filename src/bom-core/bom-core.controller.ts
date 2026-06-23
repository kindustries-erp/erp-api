import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CoreRbacGuard } from '../auth/guards/core-rbac.guard';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { PaginationDto } from '../common/dto/pagination.dto';
import { BomCoreService } from './bom-core.service';
import { CreateBomDto } from './dto/create-bom.dto';
import { UpdateBomDto } from './dto/update-bom.dto';
import { ListBomDto } from './dto/list-bom.dto';

@ApiTags('erp_bom')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, CoreRbacGuard)
@Controller('bom')
export class BomCoreController {
  constructor(private readonly service: BomCoreService) {}

  @RequirePermissions({ resource: 'bom', action: 'create' })
  @Post()
  create(@Body() dto: CreateBomDto) {
    return this.service.create(dto);
  }

  @RequirePermissions({ resource: 'bom', action: 'read' })
  @Get()
  findAll(@Query() query: ListBomDto) {
    return this.service.findAll(query);
  }

  @RequirePermissions({ resource: 'bom', action: 'read' })
  @Get(':id/export')
  async exportBom(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query('format') format: 'xlsx' | 'csv',
    @Res() res: Response,
  ) {
    const fileFormat = format === 'csv' ? 'csv' : 'xlsx';
    const { buffer, contentType, filename } =
      await this.service.exportMultiLevelBom(id, fileFormat);
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  }

  @RequirePermissions({ resource: 'bom', action: 'read' })
  @Get(':id')
  findOne(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.findOne(id);
  }

  @RequirePermissions({ resource: 'bom', action: 'update' })
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateBomDto) {
    return this.service.update(id, dto);
  }

  @RequirePermissions({ resource: 'bom', action: 'delete' })
  @Delete(':id')
  remove(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.remove(id);
  }
}
