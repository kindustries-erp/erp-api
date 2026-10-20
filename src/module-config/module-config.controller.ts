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
import { CoreRbacGuard } from '../auth/guards/core-rbac.guard';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { ErpAction, ErpResource } from '../rbac-core/enums';
import { AuditLog } from '../audit-core/decorators/audit-log.decorator';
import { EntityValuesPermissionGuard } from './guards/entity-values-permission.guard';
import { ModuleConfigService } from './module-config.service';
import { CreateModuleCategoryDto } from './dto/create-module-category.dto';
import { UpdateModuleCategoryDto } from './dto/update-module-category.dto';
import { CreateModuleAttrDefDto } from './dto/create-module-attr-def.dto';
import { UpdateModuleAttrDefDto } from './dto/update-module-attr-def.dto';
import { SaveEntityValuesDto } from './dto/save-entity-values.dto';

@ApiTags('erp_module_config')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, CoreRbacGuard)
@Controller(['module-config', 'bom-config'])
export class ModuleConfigController {
  constructor(private readonly service: ModuleConfigService) {}

  // ================= Categories =================

  @Get('categories')
  getCategories(@Query('moduleKey') moduleKey?: string) {
    return this.service.getCategories(moduleKey);
  }

  @AuditLog({ module: 'module-config', entityType: 'module_category' })
  @RequirePermissions({
    resource: ErpResource.CUSTOM_FIELDS,
    action: ErpAction.MANAGE,
  })
  @Post('categories')
  createCategory(@Body() dto: CreateModuleCategoryDto) {
    return this.service.createCategory(dto);
  }

  @AuditLog({ module: 'module-config', entityType: 'module_category' })
  @RequirePermissions({
    resource: ErpResource.CUSTOM_FIELDS,
    action: ErpAction.MANAGE,
  })
  @Patch('categories/:id')
  updateCategory(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateModuleCategoryDto,
  ): Promise<any> {
    return this.service.updateCategory(id, dto);
  }

  @AuditLog({ module: 'module-config', entityType: 'module_category' })
  @RequirePermissions({
    resource: ErpResource.CUSTOM_FIELDS,
    action: ErpAction.MANAGE,
  })
  @Delete('categories/:id')
  deleteCategory(@Param('id', new ParseUUIDPipe()) id: string): Promise<any> {
    return this.service.deleteCategory(id);
  }

  // ================= Attribute Defs =================

  @Get('global-attribute-defs')
  getGlobalAttributeDefs(@Query('moduleKey') moduleKey: string) {
    return this.service.getGlobalAttributeDefs(moduleKey);
  }

  @Get('attribute-defs')
  getAttributeDefs(
    @Query('categoryId') categoryId?: string,
    @Query('isGlobal') isGlobal?: string,
    @Query('moduleKey') moduleKey?: string,
  ) {
    const isGlobalBool =
      isGlobal !== undefined
        ? isGlobal === 'true' || isGlobal === '1'
        : undefined;
    return this.service.getAttributeDefs(categoryId, isGlobalBool, moduleKey);
  }

  @AuditLog({ module: 'module-config', entityType: 'module_attribute_def' })
  @RequirePermissions({
    resource: ErpResource.CUSTOM_FIELDS,
    action: ErpAction.MANAGE,
  })
  @Post('attribute-defs')
  createAttributeDef(@Body() dto: CreateModuleAttrDefDto) {
    return this.service.createAttributeDef(dto);
  }

  @AuditLog({ module: 'module-config', entityType: 'module_attribute_def' })
  @RequirePermissions({
    resource: ErpResource.CUSTOM_FIELDS,
    action: ErpAction.MANAGE,
  })
  @Patch('attribute-defs/:id')
  updateAttributeDef(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateModuleAttrDefDto,
  ): Promise<any> {
    return this.service.updateAttributeDef(id, dto);
  }

  @Get('attribute-defs/:id/options-usage')
  getAttributeOptionsUsage(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.getAttributeOptionsUsage(id);
  }

  @AuditLog({ module: 'module-config', entityType: 'module_attribute_def' })
  @RequirePermissions({
    resource: ErpResource.CUSTOM_FIELDS,
    action: ErpAction.MANAGE,
  })
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

  @UseGuards(EntityValuesPermissionGuard)
  @Put('values/:entityType/:entityId')
  saveEntityValues(
    @Param('entityType') entityType: string,
    @Param('entityId', new ParseUUIDPipe()) entityId: string,
    @Body() dto: SaveEntityValuesDto,
  ) {
    return this.service.saveEntityValues(entityType, entityId, dto);
  }
}
