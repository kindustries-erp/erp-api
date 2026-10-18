import { Injectable } from '@nestjs/common';
import { ErpModuleCategory } from './entities/erp_module_category.entity';
import { ErpModuleAttributeDef } from './entities/erp_module_attribute_def.entity';
import { CreateModuleCategoryDto } from './dto/create-module-category.dto';
import { UpdateModuleCategoryDto } from './dto/update-module-category.dto';
import { CreateModuleAttrDefDto } from './dto/create-module-attr-def.dto';
import { UpdateModuleAttrDefDto } from './dto/update-module-attr-def.dto';
import { SaveEntityValuesDto } from './dto/save-entity-values.dto';
import { ModuleCategoryService } from './services/module-category.service';
import { ModuleAttributeDefService } from './services/module-attribute-def.service';
import { ModuleEntityValueService } from './services/module-entity-value.service';

/**
 * ModuleConfigService (Facade)
 * Điều phối các sub-services: ModuleCategoryService, ModuleAttributeDefService, ModuleEntityValueService
 * Đảm bảo 100% backward compatibility cho các module và controller hiện có.
 */
@Injectable()
export class ModuleConfigService {
  constructor(
    private readonly categoryService: ModuleCategoryService,
    private readonly attrDefService: ModuleAttributeDefService,
    private readonly entityValueService: ModuleEntityValueService,
  ) {}

  // ==================== CATEGORIES ====================

  /**
   * Lấy danh sách Categories theo moduleKey kèm theo AttributeDefs và usageCount
   */
  async getCategories(moduleKey?: string): Promise<ErpModuleCategory[]> {
    return this.categoryService.getCategories(moduleKey);
  }

  /**
   * Tạo Category mới
   */
  async createCategory(
    dto: CreateModuleCategoryDto,
  ): Promise<ErpModuleCategory> {
    return this.categoryService.createCategory(dto);
  }

  /**
   * Cập nhật Category
   */
  async updateCategory(
    id: string,
    dto: UpdateModuleCategoryDto,
  ): Promise<ErpModuleCategory> {
    return this.categoryService.updateCategory(id, dto);
  }

  /**
   * Xóa Category (soft-delete)
   */
  async deleteCategory(id: string): Promise<void> {
    return this.categoryService.deleteCategory(id);
  }

  // ==================== ATTRIBUTE DEFS ====================

  /**
   * Lấy danh sách Global Attribute Defs cho một phân hệ cụ thể
   */
  async getGlobalAttributeDefs(
    moduleKey: string,
  ): Promise<ErpModuleAttributeDef[]> {
    return this.attrDefService.getGlobalAttributeDefs(moduleKey);
  }

  /**
   * Lấy danh sách AttributeDefs theo categoryId hoặc isGlobal
   */
  async getAttributeDefs(
    categoryId?: string,
    isGlobal?: boolean,
    moduleKey?: string,
  ): Promise<ErpModuleAttributeDef[]> {
    return this.attrDefService.getAttributeDefs(
      categoryId,
      isGlobal,
      moduleKey,
    );
  }

  /**
   * Tạo AttributeDef mới
   */
  async createAttributeDef(
    dto: CreateModuleAttrDefDto,
  ): Promise<ErpModuleAttributeDef> {
    return this.attrDefService.createAttributeDef(dto);
  }

  /**
   * Cập nhật AttributeDef
   */
  async updateAttributeDef(
    id: string,
    dto: UpdateModuleAttrDefDto,
  ): Promise<ErpModuleAttributeDef> {
    return this.attrDefService.updateAttributeDef(id, dto);
  }

  /**
   * Xóa AttributeDef (soft-delete)
   */
  async deleteAttributeDef(id: string): Promise<void> {
    return this.attrDefService.deleteAttributeDef(id);
  }

  /**
   * Đếm số lượng bản ghi đang sử dụng từng option value của một thuộc tính
   */
  async getAttributeOptionsUsage(
    attrDefId: string,
  ): Promise<Record<string, number>> {
    return this.attrDefService.getAttributeOptionsUsage(attrDefId);
  }

  // ==================== ENTITY VALUES ====================

  /**
   * Lấy cấu hình custom fields (category + attributes + globalAttributes + values) của một entity
   */
  async getEntityValues(entityType: string, entityId: string) {
    return this.entityValueService.getEntityValues(entityType, entityId);
  }

  /**
   * Lưu cấu hình custom fields (category + attributes + globalAttributes) cho một entity
   */
  async saveEntityValues(
    entityType: string,
    entityId: string,
    dto: SaveEntityValuesDto,
  ) {
    return this.entityValueService.saveEntityValues(entityType, entityId, dto);
  }
}
