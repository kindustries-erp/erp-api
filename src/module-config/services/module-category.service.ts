import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { ErpModuleCategory } from '../entities/erp_module_category.entity';
import { ErpModuleAttributeDef } from '../entities/erp_module_attribute_def.entity';
import { ErpEntityAttributeValue } from '../entities/erp_entity_attribute_value.entity';
import { CreateModuleCategoryDto } from '../dto/create-module-category.dto';
import { UpdateModuleCategoryDto } from '../dto/update-module-category.dto';

@Injectable()
export class ModuleCategoryService {
  constructor(
    @InjectRepository(ErpModuleCategory)
    private readonly categoryRepo: Repository<ErpModuleCategory>,
    @InjectRepository(ErpModuleAttributeDef)
    private readonly attrDefRepo: Repository<ErpModuleAttributeDef>,
    @InjectRepository(ErpEntityAttributeValue)
    private readonly entityAttrValueRepo: Repository<ErpEntityAttributeValue>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Helper tính toán usageCount tổng hợp từ Entity Attribute Values
   */
  private async getUsageCounts(defIds: string[]): Promise<Map<string, number>> {
    if (defIds.length === 0) return new Map();

    const entityCounts = await this.entityAttrValueRepo
      .createQueryBuilder('val')
      .select('val.attr_def_id', 'attrDefId')
      .addSelect('COUNT(DISTINCT val.entity_id)', 'count')
      .where('val.attr_def_id IN (:...defIds)', { defIds })
      .groupBy('val.attr_def_id')
      .getRawMany<{ attrDefId: string; count: string }>();

    const usageMap = new Map<string, number>();
    for (const row of entityCounts) {
      usageMap.set(
        row.attrDefId,
        (usageMap.get(row.attrDefId) || 0) + (parseInt(row.count, 10) || 0),
      );
    }

    return usageMap;
  }

  /**
   * Lấy danh sách Categories theo moduleKey kèm theo AttributeDefs và usageCount cho từng Def
   */
  async getCategories(moduleKey?: string): Promise<ErpModuleCategory[]> {
    const where: any = { isDeleted: false };
    if (moduleKey) {
      where.moduleKey = moduleKey.trim().toUpperCase();
    }

    const categories = await this.categoryRepo.find({
      where,
      order: { createdAt: 'ASC' },
      relations: {
        attributeDefs: true,
      },
    });

    // Lấy usageCount cho tất cả attributeDefs
    const allDefs = categories.flatMap((c) => c.attributeDefs || []);
    const activeDefs = allDefs.filter((d) => !d.isDeleted && !d.isGlobal);

    if (activeDefs.length > 0) {
      const defIds = activeDefs.map((d) => d.id);
      const usageMap = await this.getUsageCounts(defIds);

      for (const cat of categories) {
        if (cat.attributeDefs) {
          cat.attributeDefs = cat.attributeDefs
            .filter((d) => !d.isDeleted && !d.isGlobal)
            .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
            .map((def) => ({
              ...def,
              usageCount: usageMap.get(def.id) || 0,
            }));
        }
      }
    }

    return categories;
  }

  /**
   * Tạo Category mới
   */
  async createCategory(
    dto: CreateModuleCategoryDto,
  ): Promise<ErpModuleCategory> {
    const code = dto.code.trim().toUpperCase();
    const moduleKey = (dto.moduleKey || 'BOM').trim().toUpperCase();

    // Check duplicate code in same moduleKey
    const existing = await this.categoryRepo.findOne({
      where: {
        code,
        moduleKey,
        isDeleted: false,
      },
    });
    if (existing) {
      throw new ConflictException(
        `Mã danh mục "${code}" đã tồn tại trong phân hệ ${moduleKey}.`,
      );
    }

    const category = this.categoryRepo.create({
      code,
      name: dto.name.trim(),
      nameEn: dto.nameEn ? dto.nameEn.trim() : null,
      description: dto.description ? dto.description.trim() : null,
      moduleKey,
      isActive: dto.isActive !== undefined ? dto.isActive : true,
    });

    return this.categoryRepo.save(category);
  }

  /**
   * Cập nhật Category
   */
  async updateCategory(
    id: string,
    dto: UpdateModuleCategoryDto,
  ): Promise<ErpModuleCategory> {
    const category = await this.categoryRepo.findOne({
      where: { id, isDeleted: false },
    });
    if (!category) {
      throw new NotFoundException(`Không tìm thấy danh mục ID ${id}`);
    }

    if (dto.code) {
      const code = dto.code.trim().toUpperCase();
      if (code !== category.code) {
        const existing = await this.categoryRepo.findOne({
          where: {
            code,
            moduleKey: category.moduleKey,
            isDeleted: false,
          },
        });
        if (existing && existing.id !== id) {
          throw new ConflictException(
            `Mã danh mục "${code}" đã tồn tại trong phân hệ ${category.moduleKey}.`,
          );
        }
        category.code = code;
      }
    }

    if (dto.name !== undefined) {
      category.name = dto.name.trim();
    }
    if (dto.nameEn !== undefined) {
      category.nameEn = dto.nameEn ? dto.nameEn.trim() : null;
    }
    if (dto.description !== undefined) {
      category.description = dto.description ? dto.description.trim() : null;
    }
    if (dto.isActive !== undefined) {
      category.isActive = dto.isActive;
    }

    return this.categoryRepo.save(category);
  }

  /**
   * Xóa Category (soft-delete, kiểm tra usage)
   */
  async deleteCategory(id: string): Promise<void> {
    const category = await this.categoryRepo.findOne({
      where: { id, isDeleted: false },
      relations: { attributeDefs: true },
    });
    if (!category) {
      throw new NotFoundException(`Không tìm thấy danh mục ID ${id}`);
    }

    // Check if category is used by any BOM
    const bomCount = await this.dataSource.query(
      `SELECT COUNT(*)::int as count FROM erp_boms WHERE category_id = $1 AND is_deleted = false`,
      [id],
    );
    if (bomCount?.[0]?.count > 0) {
      throw new ConflictException(
        `Danh mục đang được sử dụng trong ${bomCount[0].count} BOM, không thể xóa. Vui lòng chuyển sang trạng thái Ngừng hoạt động.`,
      );
    }

    // Check if category is used by any Invoices
    const invoiceCount = await this.dataSource.query(
      `SELECT COUNT(*)::int as count FROM erp_invoices WHERE category_id = $1 AND is_deleted = false`,
      [id],
    );
    if (invoiceCount?.[0]?.count > 0) {
      throw new ConflictException(
        `Danh mục đang được sử dụng trong ${invoiceCount[0].count} Hóa đơn, không thể xóa. Vui lòng chuyển sang trạng thái Ngừng hoạt động.`,
      );
    }

    // Check if category is used in erp_entity_attribute_values
    const entityValueCount = await this.entityAttrValueRepo.count({
      where: { categoryId: id },
    });
    if (entityValueCount > 0) {
      throw new ConflictException(
        `Danh mục đang được sử dụng trong ${entityValueCount} bản ghi thực thể, không thể xóa. Vui lòng chuyển sang trạng thái Ngừng hoạt động.`,
      );
    }

    // Soft delete all child attribute defs
    if (category.attributeDefs && category.attributeDefs.length > 0) {
      const defIds = category.attributeDefs.map((d) => d.id);
      await this.attrDefRepo.update({ id: In(defIds) }, { isDeleted: true });
    }

    category.isDeleted = true;
    await this.categoryRepo.save(category);
  }
}
