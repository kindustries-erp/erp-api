import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, In, Repository } from 'typeorm';
import { ErpBomCategory } from './entities/erp_bom_category.entity';
import {
  BomAttributeOption,
  ErpBomAttributeDef,
} from './entities/erp_bom_attribute_def.entity';
import { ErpBomAttributeValue } from './entities/erp_bom_attribute_value.entity';
import { CreateBomCategoryDto } from './dto/create-bom-category.dto';
import { UpdateBomCategoryDto } from './dto/update-bom-category.dto';
import { CreateBomAttributeDefDto } from './dto/create-bom-attribute-def.dto';
import { UpdateBomAttributeDefDto } from './dto/update-bom-attribute-def.dto';

@Injectable()
export class BomConfigService {
  constructor(
    @InjectRepository(ErpBomCategory)
    private readonly categoryRepo: Repository<ErpBomCategory>,
    @InjectRepository(ErpBomAttributeDef)
    private readonly attrDefRepo: Repository<ErpBomAttributeDef>,
    @InjectRepository(ErpBomAttributeValue)
    private readonly attrValueRepo: Repository<ErpBomAttributeValue>,
  ) {}

  /**
   * Helper validate unique options keys for SELECT field type
   */
  private validateSelectOptions(options?: BomAttributeOption[] | null) {
    if (!options || options.length === 0) {
      throw new BadRequestException(
        'Thuộc tính dạng Combobox (SELECT) cần ít nhất 1 option lựa chọn.',
      );
    }

    const seenValues = new Set<string>();
    for (const opt of options) {
      const val = (opt.value || '').trim().toUpperCase();
      const lbl = (opt.label || '').trim();
      if (!val) {
        throw new BadRequestException(
          'Mã / Key của option không được để trống.',
        );
      }
      if (!lbl) {
        throw new BadRequestException(
          'Tên hiển thị của option không được để trống.',
        );
      }
      if (seenValues.has(val)) {
        throw new BadRequestException(
          `Mã option (Key) "${val}" bị trùng lặp. Vui lòng đặt mã khác nhau.`,
        );
      }
      seenValues.add(val);
    }
  }

  /**
   * Lấy danh sách Categories kèm theo AttributeDefs và usageCount cho từng Def
   */
  async getCategories(): Promise<ErpBomCategory[]> {
    const categories = await this.categoryRepo.find({
      where: { isDeleted: false },
      order: { createdAt: 'ASC' },
      relations: {
        attributeDefs: true,
      },
    });

    // Lấy usageCount cho tất cả attributeDefs
    const allDefs = categories.flatMap((c) => c.attributeDefs || []);
    const activeDefs = allDefs.filter((d) => !d.isDeleted);

    if (activeDefs.length > 0) {
      const defIds = activeDefs.map((d) => d.id);
      const usageCounts = await this.attrValueRepo
        .createQueryBuilder('val')
        .select('val.attr_def_id', 'attrDefId')
        .addSelect('COUNT(DISTINCT val.bom_id)', 'count')
        .where('val.attr_def_id IN (:...defIds)', { defIds })
        .groupBy('val.attr_def_id')
        .getRawMany<{ attrDefId: string; count: string }>();

      const usageMap = new Map<string, number>();
      for (const row of usageCounts) {
        usageMap.set(row.attrDefId, parseInt(row.count, 10) || 0);
      }

      for (const cat of categories) {
        if (cat.attributeDefs) {
          cat.attributeDefs = cat.attributeDefs
            .filter((d) => !d.isDeleted)
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
  async createCategory(dto: CreateBomCategoryDto): Promise<ErpBomCategory> {
    const code = dto.code.trim().toUpperCase();
    const existing = await this.categoryRepo.findOne({
      where: { code: ILike(code), isDeleted: false },
    });

    if (existing) {
      throw new ConflictException(`Mã danh mục "${code}" đã tồn tại.`);
    }

    const cat = this.categoryRepo.create({
      code,
      name: dto.name.trim(),
      description: dto.description?.trim() || null,
      isActive: dto.isActive ?? true,
    });

    return this.categoryRepo.save(cat);
  }

  /**
   * Cập nhật Category
   */
  async updateCategory(
    id: string,
    dto: UpdateBomCategoryDto,
  ): Promise<ErpBomCategory> {
    const cat = await this.categoryRepo.findOne({
      where: { id, isDeleted: false },
      relations: { attributeDefs: true },
    });
    if (!cat) {
      throw new NotFoundException(`Không tìm thấy danh mục BOM ID ${id}`);
    }

    // Kiểm tra xem danh mục có thuộc tính nào đang có BOM dùng không
    const defs = (cat.attributeDefs || []).filter((d) => !d.isDeleted);
    let inUseCount = 0;
    if (defs.length > 0) {
      const defIds = defs.map((d) => d.id);
      inUseCount = await this.attrValueRepo.count({
        where: { attrDefId: In(defIds) },
      });
    }

    if (dto.code) {
      const code = dto.code.trim().toUpperCase();
      if (code !== cat.code) {
        if (inUseCount > 0) {
          throw new ConflictException(
            'Danh mục đang có dữ liệu trong BOM, không thể thay đổi mã danh mục.',
          );
        }
        const existing = await this.categoryRepo.findOne({
          where: { code: ILike(code), isDeleted: false },
        });
        if (existing && existing.id !== id) {
          throw new ConflictException(`Mã danh mục "${code}" đã tồn tại.`);
        }
        cat.code = code;
      }
    }

    if (dto.name !== undefined) {
      cat.name = dto.name.trim();
    }
    if (dto.description !== undefined) {
      cat.description = dto.description?.trim() || null;
    }
    if (dto.isActive !== undefined) {
      cat.isActive = dto.isActive;
    }

    return this.categoryRepo.save(cat);
  }

  /**
   * Xóa Category (soft-delete)
   */
  async deleteCategory(id: string): Promise<void> {
    const cat = await this.categoryRepo.findOne({
      where: { id, isDeleted: false },
      relations: { attributeDefs: true },
    });
    if (!cat) {
      throw new NotFoundException(`Không tìm thấy danh mục BOM ID ${id}`);
    }

    // Kiểm tra xem có attributeDef nào có usageCount > 0 không
    const defs = (cat.attributeDefs || []).filter((d) => !d.isDeleted);
    if (defs.length > 0) {
      const defIds = defs.map((d) => d.id);
      const usedCount = await this.attrValueRepo.count({
        where: { attrDefId: In(defIds) },
      });
      if (usedCount > 0) {
        throw new ConflictException(
          'Danh mục có dữ liệu đang sử dụng trong BOM, không thể xóa. Vui lòng chuyển sang trạng thái Ngừng hoạt động (Deactivate).',
        );
      }

      // Soft delete all defs
      await this.attrDefRepo.update({ categoryId: id }, { isDeleted: true });
    }

    cat.isDeleted = true;
    await this.categoryRepo.save(cat);
  }

  /**
   * Lấy AttributeDefs (kèm usageCount)
   */
  async getAttributeDefs(categoryId?: string): Promise<ErpBomAttributeDef[]> {
    const where: any = { isDeleted: false };
    if (categoryId) {
      where.categoryId = categoryId;
    }

    const defs = await this.attrDefRepo.find({
      where,
      order: { sortOrder: 'ASC', createdAt: 'ASC' },
      relations: { category: true },
    });

    if (defs.length === 0) return [];

    const defIds = defs.map((d) => d.id);
    const usageCounts = await this.attrValueRepo
      .createQueryBuilder('val')
      .select('val.attr_def_id', 'attrDefId')
      .addSelect('COUNT(DISTINCT val.bom_id)', 'count')
      .where('val.attr_def_id IN (:...defIds)', { defIds })
      .groupBy('val.attr_def_id')
      .getRawMany<{ attrDefId: string; count: string }>();

    const usageMap = new Map<string, number>();
    for (const row of usageCounts) {
      usageMap.set(row.attrDefId, parseInt(row.count, 10) || 0);
    }

    return defs.map((d) => ({
      ...d,
      usageCount: usageMap.get(d.id) || 0,
    }));
  }

  /**
   * Tạo AttributeDef mới
   */
  async createAttributeDef(
    dto: CreateBomAttributeDefDto,
  ): Promise<ErpBomAttributeDef> {
    const category = await this.categoryRepo.findOne({
      where: { id: dto.categoryId, isDeleted: false },
    });
    if (!category) {
      throw new NotFoundException(
        `Không tìm thấy danh mục BOM ID ${dto.categoryId}`,
      );
    }

    const code = dto.code.trim().toLowerCase();
    const existing = await this.attrDefRepo.findOne({
      where: {
        categoryId: dto.categoryId,
        code: ILike(code),
        isDeleted: false,
      },
    });
    if (existing) {
      throw new ConflictException(
        `Mã thuộc tính "${code}" đã tồn tại trong danh mục này.`,
      );
    }

    if (dto.fieldType === 'SELECT') {
      this.validateSelectOptions(dto.options);
    }

    const def = this.attrDefRepo.create({
      categoryId: dto.categoryId,
      code,
      name: dto.name.trim(),
      fieldType: dto.fieldType,
      options: dto.options || null,
      sortOrder: dto.sortOrder ?? 0,
      isRequired: dto.isRequired ?? false,
      isActive: dto.isActive ?? true,
    });

    const saved = await this.attrDefRepo.save(def);
    return { ...saved, usageCount: 0 };
  }

  /**
   * Cập nhật AttributeDef
   */
  async updateAttributeDef(
    id: string,
    dto: UpdateBomAttributeDefDto,
  ): Promise<ErpBomAttributeDef> {
    const def = await this.attrDefRepo.findOne({
      where: { id, isDeleted: false },
    });
    if (!def) {
      throw new NotFoundException(`Không tìm thấy thuộc tính BOM ID ${id}`);
    }

    const usageCount = await this.attrValueRepo.count({
      where: { attrDefId: id },
    });

    // Nếu đã có BOM sử dụng, chặn đổi code và fieldType
    if (usageCount > 0) {
      if (dto.code && dto.code.trim().toLowerCase() !== def.code) {
        throw new ConflictException(
          'Thuộc tính đang được sử dụng trong BOM, không thể thay đổi mã thuộc tính.',
        );
      }
      if (dto.fieldType && dto.fieldType !== def.fieldType) {
        throw new ConflictException(
          'Thuộc tính đang được sử dụng trong BOM, không thể thay đổi kiểu dữ liệu.',
        );
      }
    }

    if (dto.code) {
      const code = dto.code.trim().toLowerCase();
      if (code !== def.code) {
        const existing = await this.attrDefRepo.findOne({
          where: {
            categoryId: def.categoryId,
            code: ILike(code),
            isDeleted: false,
          },
        });
        if (existing && existing.id !== id) {
          throw new ConflictException(
            `Mã thuộc tính "${code}" đã tồn tại trong danh mục này.`,
          );
        }
        def.code = code;
      }
    }

    if (dto.name !== undefined) {
      def.name = dto.name.trim();
    }
    if (dto.fieldType !== undefined && usageCount === 0) {
      def.fieldType = dto.fieldType;
    }
    if (dto.options !== undefined) {
      if (def.fieldType === 'SELECT' || dto.fieldType === 'SELECT') {
        this.validateSelectOptions(dto.options);
      }
      def.options = dto.options;
    }
    if (dto.sortOrder !== undefined) {
      def.sortOrder = dto.sortOrder;
    }
    if (dto.isRequired !== undefined) {
      def.isRequired = dto.isRequired;
    }
    if (dto.isActive !== undefined) {
      def.isActive = dto.isActive;
    }

    const saved = await this.attrDefRepo.save(def);
    return { ...saved, usageCount };
  }

  /**
   * Xóa AttributeDef (soft-delete)
   */
  async deleteAttributeDef(id: string): Promise<void> {
    const def = await this.attrDefRepo.findOne({
      where: { id, isDeleted: false },
    });
    if (!def) {
      throw new NotFoundException(`Không tìm thấy thuộc tính BOM ID ${id}`);
    }

    const usageCount = await this.attrValueRepo.count({
      where: { attrDefId: id },
    });

    if (usageCount > 0) {
      throw new ConflictException(
        'Thuộc tính đang được sử dụng trong BOM, không thể xóa. Vui lòng chuyển sang trạng thái Ngừng hoạt động (Deactivate).',
      );
    }

    def.isDeleted = true;
    await this.attrDefRepo.save(def);
  }
}
