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
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CoreRbacGuard } from '../auth/guards/core-rbac.guard';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { ErpResource, ErpAction } from '@/rbac-core/enums';
import { BomConfigService } from './bom-config.service';
import { CreateBomCategoryDto } from './dto/create-bom-category.dto';
import { UpdateBomCategoryDto } from './dto/update-bom-category.dto';
import { CreateBomAttributeDefDto } from './dto/create-bom-attribute-def.dto';
import { UpdateBomAttributeDefDto } from './dto/update-bom-attribute-def.dto';

@ApiTags('erp_bom_config')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, CoreRbacGuard)
@Controller('bom-config')
export class BomConfigController {
  constructor(private readonly service: BomConfigService) {}

  // ================= Categories =================

  @RequirePermissions({ resource: ErpResource.BOM, action: ErpAction.READ })
  @Get('categories')
  getCategories() {
    return this.service.getCategories();
  }

  @RequirePermissions({ resource: ErpResource.BOM, action: ErpAction.UPDATE })
  @Post('categories')
  createCategory(@Body() dto: CreateBomCategoryDto) {
    return this.service.createCategory(dto);
  }

  @RequirePermissions({ resource: ErpResource.BOM, action: ErpAction.UPDATE })
  @Patch('categories/:id')
  updateCategory(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateBomCategoryDto,
  ): Promise<any> {
    return this.service.updateCategory(id, dto);
  }

  @RequirePermissions({ resource: ErpResource.BOM, action: ErpAction.UPDATE })
  @Delete('categories/:id')
  deleteCategory(@Param('id', new ParseUUIDPipe()) id: string): Promise<any> {
    return this.service.deleteCategory(id);
  }

  // ================= Attribute Defs =================

  @RequirePermissions({ resource: ErpResource.BOM, action: ErpAction.READ })
  @Get('attribute-defs')
  getAttributeDefs(@Query('categoryId') categoryId?: string) {
    return this.service.getAttributeDefs(categoryId);
  }

  @RequirePermissions({ resource: ErpResource.BOM, action: ErpAction.UPDATE })
  @Post('attribute-defs')
  createAttributeDef(@Body() dto: CreateBomAttributeDefDto) {
    return this.service.createAttributeDef(dto);
  }

  @RequirePermissions({ resource: ErpResource.BOM, action: ErpAction.UPDATE })
  @Patch('attribute-defs/:id')
  updateAttributeDef(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateBomAttributeDefDto,
  ): Promise<any> {
    return this.service.updateAttributeDef(id, dto);
  }

  @RequirePermissions({ resource: ErpResource.BOM, action: ErpAction.UPDATE })
  @Delete('attribute-defs/:id')
  deleteAttributeDef(
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<any> {
    return this.service.deleteAttributeDef(id);
  }
}
