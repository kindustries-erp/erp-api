import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ModuleConfigService } from './module-config.service';
import { CreateModuleCategoryDto } from './dto/create-module-category.dto';
import { UpdateModuleCategoryDto } from './dto/update-module-category.dto';
import { CreateModuleAttrDefDto } from './dto/create-module-attr-def.dto';
import { UpdateModuleAttrDefDto } from './dto/update-module-attr-def.dto';
import { SaveEntityValuesDto } from './dto/save-entity-values.dto';

@ApiTags('erp_module_config')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('module-config')
export class ModuleConfigController {
  constructor(private readonly service: ModuleConfigService) {}

  // ================= Categories =================

  @Get('categories')
  getCategories(@Query('moduleKey') moduleKey?: string) {
    return this.service.getCategories(moduleKey);
  }

  @Post('categories')
  createCategory(@Body() dto: CreateModuleCategoryDto) {
    return this.service.createCategory(dto);
  }

  @Patch('categories/:id')
  updateCategory(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateModuleCategoryDto,
  ): Promise<any> {
    return this.service.updateCategory(id, dto);
  }

  @Delete('categories/:id')
  deleteCategory(@Param('id', new ParseUUIDPipe()) id: string): Promise<any> {
    return this.service.deleteCategory(id);
  }

  // ================= Attribute Defs =================

  @Get('attribute-defs')
  getAttributeDefs(@Query('categoryId') categoryId?: string) {
    return this.service.getAttributeDefs(categoryId);
  }

  @Post('attribute-defs')
  createAttributeDef(@Body() dto: CreateModuleAttrDefDto) {
    return this.service.createAttributeDef(dto);
  }

  @Patch('attribute-defs/:id')
  updateAttributeDef(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateModuleAttrDefDto,
  ): Promise<any> {
    return this.service.updateAttributeDef(id, dto);
  }

  @Delete('attribute-defs/:id')
  deleteAttributeDef(
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<any> {
    return this.service.deleteAttributeDef(id);
  }

  // ================= Entity Values =================

  @Get('values/:entityType/:entityId')
  getEntityValues(
    @Param('entityType') entityType: string,
    @Param('entityId', new ParseUUIDPipe()) entityId: string,
  ) {
    return this.service.getEntityValues(entityType, entityId);
  }

  @Put('values/:entityType/:entityId')
  saveEntityValues(
    @Param('entityType') entityType: string,
    @Param('entityId', new ParseUUIDPipe()) entityId: string,
    @Body() dto: SaveEntityValuesDto,
  ) {
    return this.service.saveEntityValues(entityType, entityId, dto);
  }
}
