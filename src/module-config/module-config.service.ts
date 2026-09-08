import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, ILike, In, Repository } from 'typeorm';
import { ErpModuleCategory } from './entities/erp_module_category.entity';
import {
  ModuleAttributeOption,
  ErpModuleAttributeDef,
} from './entities/erp_module_attribute_def.entity';
import { ErpEntityAttributeValue } from './entities/erp_entity_attribute_value.entity';
import { CreateModuleCategoryDto } from './dto/create-module-category.dto';
import { UpdateModuleCategoryDto } from './dto/update-module-category.dto';
import { CreateModuleAttrDefDto } from './dto/create-module-attr-def.dto';
import { UpdateModuleAttrDefDto } from './dto/update-module-attr-def.dto';
import { SaveEntityValuesDto } from './dto/save-entity-values.dto';

@Injectable()
export class ModuleConfigService {
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
   * Helper validate unique options keys for SELECT field type
   */
  private validateSelectOptions(options?: ModuleAttributeOption[] | null) {
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
        `Mã danh mục "${code}" đã tồn tại trong phân hệ "${moduleKey}".`,
      );
    }

    const category = this.categoryRepo.create({
      code,
      moduleKey,
      name: dto.name.trim(),
      nameEn: dto.nameEn ? dto.nameEn.trim() : null,
      description: dto.description ? dto.description.trim() : null,
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
            `Mã danh mục "${code}" đã tồn tại trong phân hệ "${category.moduleKey}".`,
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
   * Xóa Category (soft-delete)
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

  /**
   * Lấy danh sách Global Attribute Defs cho một phân hệ cụ thể
   */
  async getGlobalAttributeDefs(
    moduleKey: string,
  ): Promise<ErpModuleAttributeDef[]> {
    const upperKey = (moduleKey || '').trim().toUpperCase();
    const defs = await this.attrDefRepo.find({
      where: {
        isGlobal: true,
        moduleKeyGlobal: upperKey,
        isDeleted: false,
      },
      order: { sortOrder: 'ASC', createdAt: 'ASC' },
    });

    if (defs.length > 0) {
      const defIds = defs.map((d) => d.id);
      const usageMap = await this.getUsageCounts(defIds);
      return defs.map((d) => ({
        ...d,
        usageCount: usageMap.get(d.id) || 0,
      }));
    }

    return [];
  }

  /**
   * Lấy danh sách AttributeDefs theo categoryId hoặc isGlobal
   */
  async getAttributeDefs(
    categoryId?: string,
    isGlobal?: boolean,
    moduleKey?: string,
  ): Promise<ErpModuleAttributeDef[]> {
    const where: any = { isDeleted: false };
    if (isGlobal !== undefined) {
      where.isGlobal = isGlobal;
    }
    if (categoryId) {
      where.categoryId = categoryId;
    }
    if (moduleKey) {
      where.moduleKeyGlobal = moduleKey.trim().toUpperCase();
    }

    const defs = await this.attrDefRepo.find({
      where,
      order: { sortOrder: 'ASC', createdAt: 'ASC' },
    });

    if (defs.length > 0) {
      const defIds = defs.map((d) => d.id);
      const usageMap = await this.getUsageCounts(defIds);
      return defs.map((d) => ({
        ...d,
        usageCount: usageMap.get(d.id) || 0,
      }));
    }

    return [];
  }

  /**
   * Tạo AttributeDef mới
   */
  async createAttributeDef(
    dto: CreateModuleAttrDefDto,
  ): Promise<ErpModuleAttributeDef> {
    const isGlobal = dto.isGlobal === true;
    const code = dto.code.trim().toLowerCase();

    if (isGlobal) {
      if (!dto.moduleKeyGlobal) {
        throw new BadRequestException(
          'Thuộc tính chung (isGlobal = true) bắt buộc phải chỉ định phân hệ (moduleKeyGlobal).',
        );
      }
      const upperModuleKey = dto.moduleKeyGlobal.trim().toUpperCase();

      const existing = await this.attrDefRepo.findOne({
        where: {
          isGlobal: true,
          moduleKeyGlobal: upperModuleKey,
          code: ILike(code),
          isDeleted: false,
        },
      });
      if (existing) {
        throw new ConflictException(
          `Mã thuộc tính chung "${code}" đã tồn tại trong phân hệ "${upperModuleKey}".`,
        );
      }
    } else {
      if (!dto.categoryId) {
        throw new BadRequestException(
          'Thuộc tính theo danh mục bắt buộc phải có categoryId.',
        );
      }
      const category = await this.categoryRepo.findOne({
        where: { id: dto.categoryId, isDeleted: false },
      });
      if (!category) {
        throw new NotFoundException(
          `Không tìm thấy danh mục ID ${dto.categoryId}`,
        );
      }

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
    }

    if (dto.fieldType === 'SELECT') {
      this.validateSelectOptions(dto.options);
    }

    const def = this.attrDefRepo.create({
      categoryId: isGlobal ? null : dto.categoryId,
      isGlobal,
      moduleKeyGlobal: isGlobal
        ? dto.moduleKeyGlobal!.trim().toUpperCase()
        : null,
      code,
      name: dto.name.trim(),
      nameEn: dto.nameEn ? dto.nameEn.trim() : null,
      fieldType: dto.fieldType || 'TEXT',
      options: dto.fieldType === 'SELECT' ? dto.options || [] : null,
      sortOrder: dto.sortOrder || 0,
      isRequired: dto.isRequired !== undefined ? dto.isRequired : false,
      isActive: dto.isActive !== undefined ? dto.isActive : true,
      isSystem: dto.isSystem !== undefined ? dto.isSystem : false,
    });

    const saved = await this.attrDefRepo.save(def);
    return { ...saved, usageCount: 0 };
  }

  /**
   * Cập nhật AttributeDef
   */
  async updateAttributeDef(
    id: string,
    dto: UpdateModuleAttrDefDto,
  ): Promise<ErpModuleAttributeDef> {
    const def = await this.attrDefRepo.findOne({
      where: { id, isDeleted: false },
    });
    if (!def) {
      throw new NotFoundException(`Không tìm thấy thuộc tính ID ${id}`);
    }

    const usageCount = await this.entityAttrValueRepo.count({
      where: { attrDefId: id },
    });

    // Thuộc tính hệ thống: không cho phép đổi code và fieldType
    if (def.isSystem) {
      if (dto.code && dto.code.trim().toLowerCase() !== def.code) {
        throw new ConflictException(
          'Thuộc tính mặc định của hệ thống không thể thay đổi mã thuộc tính.',
        );
      }
      if (dto.fieldType && dto.fieldType !== def.fieldType) {
        throw new ConflictException(
          'Thuộc tính mặc định của hệ thống không thể thay đổi kiểu dữ liệu.',
        );
      }
    }

    // Nếu đã có dữ liệu sử dụng, chặn đổi code và fieldType
    if (usageCount > 0) {
      if (dto.code && dto.code.trim().toLowerCase() !== def.code) {
        throw new ConflictException(
          'Thuộc tính đang được sử dụng, không thể thay đổi mã thuộc tính.',
        );
      }
      if (dto.fieldType && dto.fieldType !== def.fieldType) {
        throw new ConflictException(
          'Thuộc tính đang được sử dụng, không thể thay đổi kiểu dữ liệu.',
        );
      }
    }

    if (dto.code) {
      const code = dto.code.trim().toLowerCase();
      if (code !== def.code) {
        if (def.isGlobal) {
          const existing = await this.attrDefRepo.findOne({
            where: {
              isGlobal: true,
              moduleKeyGlobal: def.moduleKeyGlobal!,
              code: ILike(code),
              isDeleted: false,
            },
          });
          if (existing && existing.id !== id) {
            throw new ConflictException(
              `Mã thuộc tính chung "${code}" đã tồn tại trong phân hệ "${def.moduleKeyGlobal}".`,
            );
          }
        } else {
          const existing = await this.attrDefRepo.findOne({
            where: {
              categoryId: def.categoryId!,
              code: ILike(code),
              isDeleted: false,
            },
          });
          if (existing && existing.id !== id) {
            throw new ConflictException(
              `Mã thuộc tính "${code}" đã tồn tại trong danh mục này.`,
            );
          }
        }
        def.code = code;
      }
    }

    if (dto.name !== undefined) {
      def.name = dto.name.trim();
    }
    if (dto.nameEn !== undefined) {
      def.nameEn = dto.nameEn ? dto.nameEn.trim() : null;
    }
    if (dto.fieldType !== undefined && usageCount === 0 && !def.isSystem) {
      def.fieldType = dto.fieldType;
    }
    if (dto.options !== undefined) {
      if (def.fieldType === 'SELECT' || dto.fieldType === 'SELECT') {
        this.validateSelectOptions(dto.options);
      }

      // Kiểm tra xem có option nào bị xóa mà đang có dữ liệu sử dụng không (áp dụng cho cả System và Custom)
      if (def.options && def.options.length > 0) {
        const nextValues = new Set(dto.options.map((o) => o.value));
        const removedOptions = def.options.filter(
          (o) => !nextValues.has(o.value),
        );

        if (removedOptions.length > 0) {
          const usageMap = await this.getAttributeOptionsUsage(id);
          for (const rem of removedOptions) {
            const usedCount = usageMap[rem.value] || 0;
            if (usedCount > 0) {
              throw new ConflictException(
                `Tùy chọn "${rem.label || rem.value}" (${rem.value}) của thuộc tính "${def.name}" đang được sử dụng trong ${usedCount} bản ghi, không thể xóa.`,
              );
            }
            if (def.isSystem) {
              const coreCodes = [
                'PO',
                'SALE',
                'PRODUCTION',
                'PERIODIC',
                'DAMAGED',
                'COUNT_ERROR',
                'RECLASSIFY',
                'RETURN',
                'WARRANTY',
                'SCRAP',
                'OTHER',
              ];
              if (coreCodes.includes(rem.value)) {
                throw new ConflictException(
                  `Tùy chọn cốt lõi "${rem.label || rem.value}" (${rem.value}) của thuộc tính hệ thống không thể xóa.`,
                );
              }
            }
          }
        }
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
    if (dto.isSystem !== undefined) {
      def.isSystem = dto.isSystem;
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
      throw new NotFoundException(`Không tìm thấy thuộc tính ID ${id}`);
    }

    if (def.isSystem) {
      throw new BadRequestException(
        'Thuộc tính mặc định của hệ thống không thể xóa.',
      );
    }

    const usageCount = await this.entityAttrValueRepo.count({
      where: { attrDefId: id },
    });

    if (usageCount > 0) {
      throw new ConflictException(
        'Thuộc tính đang được sử dụng, không thể xóa. Vui lòng chuyển sang trạng thái Ngừng hoạt động (Deactivate).',
      );
    }

    def.isDeleted = true;
    await this.attrDefRepo.save(def);
  }

  /**
   * Đếm số lượng bản ghi đang sử dụng từng option value của một thuộc tính
   */
  async getAttributeOptionsUsage(
    attrDefId: string,
  ): Promise<Record<string, number>> {
    const def = await this.attrDefRepo.findOne({
      where: { id: attrDefId, isDeleted: false },
    });
    if (!def) {
      throw new NotFoundException(`Không tìm thấy thuộc tính ID ${attrDefId}`);
    }

    const usageMap: Record<string, number> = {};
    for (const opt of def.options || []) {
      usageMap[opt.value] = 0;
    }

    const entityRows = await this.entityAttrValueRepo
      .createQueryBuilder('eav')
      .select('eav.valueText', 'value')
      .addSelect('COUNT(*)', 'count')
      .where('eav.attrDefId = :attrDefId', { attrDefId })
      .andWhere('eav.valueText IS NOT NULL')
      .groupBy('eav.valueText')
      .getRawMany<{ value: string; count: string }>();

    for (const row of entityRows) {
      if (row.value) {
        usageMap[row.value] =
          (usageMap[row.value] || 0) + Number(row.count || 0);
      }
    }

    // 3. Quét các bảng thực thể nếu là thuộc tính hệ thống hoặc liên kết trực tiếp
    const modKey = (def.moduleKeyGlobal || '').toUpperCase();
    const attrCode = (def.code || '').toLowerCase();

    if (
      modKey === 'GOODS_RECEIPT' ||
      ['type_inventory_receipt', 'receipt_type', 'type'].includes(attrCode)
    ) {
      try {
        const [poCountRow, prodCountRow, otherCountRow] = await Promise.all([
          this.dataSource.query(
            `SELECT COUNT(*)::int as count FROM erp_goods_receipts WHERE purchase_order_id IS NOT NULL AND is_deleted = false`,
          ),
          this.dataSource.query(
            `SELECT COUNT(*)::int as count FROM erp_goods_receipts WHERE production_order_id IS NOT NULL AND is_deleted = false`,
          ),
          this.dataSource.query(
            `SELECT COUNT(*)::int as count FROM erp_goods_receipts WHERE purchase_order_id IS NULL AND production_order_id IS NULL AND is_deleted = false`,
          ),
        ]);
        if (poCountRow?.[0]?.count && usageMap['PO'] !== undefined) {
          usageMap['PO'] = (usageMap['PO'] || 0) + Number(poCountRow[0].count);
        }
        if (prodCountRow?.[0]?.count && usageMap['PRODUCTION'] !== undefined) {
          usageMap['PRODUCTION'] =
            (usageMap['PRODUCTION'] || 0) + Number(prodCountRow[0].count);
        }
        if (otherCountRow?.[0]?.count && usageMap['OTHER'] !== undefined) {
          usageMap['OTHER'] =
            (usageMap['OTHER'] || 0) + Number(otherCountRow[0].count);
        }
      } catch (e) {
        // Safe catch if table doesn't exist during certain tests
      }
    } else if (
      modKey === 'GOODS_ISSUE' ||
      ['type_inventory_issue', 'issue_type', 'type'].includes(attrCode)
    ) {
      try {
        const issueRows = await this.dataSource.query(
          `SELECT issue_type as value, COUNT(*)::int as count FROM erp_goods_issues WHERE is_deleted = false GROUP BY issue_type`,
        );
        for (const row of issueRows || []) {
          if (row.value) {
            const key = String(row.value).toUpperCase();
            if (usageMap[key] !== undefined) {
              usageMap[key] = (usageMap[key] || 0) + Number(row.count || 0);
            }
            if (key === 'LOSS' && usageMap['SCRAP'] !== undefined) {
              usageMap['SCRAP'] =
                (usageMap['SCRAP'] || 0) + Number(row.count || 0);
            }
          }
        }
      } catch (e) {
        // Safe catch
      }
    } else if (modKey === 'INVENTORY_ITEM') {
      try {
        if (attrCode === 'uom') {
          const uomRows = await this.dataSource.query(
            `SELECT u.code as value, COUNT(i.id)::int as count 
             FROM erp_inventory_items i 
             JOIN erp_uom u ON i.uom_id = u.id 
             WHERE i.is_deleted = false 
             GROUP BY u.code`,
          );
          for (const row of uomRows || []) {
            if (row.value) {
              const key = String(row.value).toUpperCase();
              if (usageMap[key] !== undefined) {
                usageMap[key] = (usageMap[key] || 0) + Number(row.count || 0);
              }
            }
          }
        } else if (attrCode === 'item_type') {
          const typeRows = await this.dataSource.query(
            `SELECT it.code as value, COUNT(i.id)::int as count 
             FROM erp_inventory_items i 
             JOIN erp_item_types it ON i.item_type_id = it.id 
             WHERE i.is_deleted = false 
             GROUP BY it.code`,
          );
          for (const row of typeRows || []) {
            if (row.value) {
              const key = String(row.value).toUpperCase();
              if (usageMap[key] !== undefined) {
                usageMap[key] = (usageMap[key] || 0) + Number(row.count || 0);
              }
            }
          }
        } else if (attrCode === 'tracking_policy') {
          const policyRows = await this.dataSource.query(
            `SELECT tp.code as value, COUNT(i.id)::int as count 
             FROM erp_inventory_items i 
             JOIN erp_tracking_policies tp ON i.tracking_policy_id = tp.id 
             WHERE i.is_deleted = false 
             GROUP BY tp.code`,
          );
          for (const row of policyRows || []) {
            if (row.value) {
              const key = String(row.value).toUpperCase();
              if (usageMap[key] !== undefined) {
                usageMap[key] = (usageMap[key] || 0) + Number(row.count || 0);
              }
            }
          }
        } else if (attrCode === 'item_features') {
          const featureRows = await this.dataSource.query(
            `SELECT unnest(attributes) as value, COUNT(*)::int as count 
             FROM erp_inventory_items 
             WHERE is_deleted = false AND attributes IS NOT NULL AND array_length(attributes, 1) > 0 
             GROUP BY value`,
          );
          for (const row of featureRows || []) {
            if (row.value) {
              const key = String(row.value).toUpperCase();
              if (usageMap[key] !== undefined) {
                usageMap[key] = (usageMap[key] || 0) + Number(row.count || 0);
              }
            }
          }
        }
      } catch (e) {
        // Safe catch
      }
    }

    return usageMap;
  }

  /**
   * Lấy cấu hình custom fields (category + attributes + globalAttributes + values) của một entity bất kỳ
   */
  async getEntityValues(entityType: string, entityId: string) {
    const upperType = entityType.trim().toUpperCase();

    // 1. Lấy categoryId từ entity table nếu có
    let categoryId: string | null = null;
    if (
      upperType === 'INVOICE' ||
      upperType === 'INVOICE_IN' ||
      upperType === 'INVOICE_OUT'
    ) {
      const rows = await this.dataSource.query(
        `SELECT category_id FROM erp_invoices WHERE id = $1`,
        [entityId],
      );
      categoryId = rows[0]?.category_id || null;
    } else if (upperType === 'BANK_TXN') {
      const rows = await this.dataSource.query(
        `SELECT category_id FROM erp_bank_transactions WHERE id = $1`,
        [entityId],
      );
      categoryId = rows[0]?.category_id || null;
    } else if (upperType === 'BOM') {
      const rows = await this.dataSource.query(
        `SELECT category_id FROM erp_boms WHERE id = $1`,
        [entityId],
      );
      categoryId = rows[0]?.category_id || null;
    } else if (upperType === 'GOODS_RECEIPT' || upperType === 'RECEIPT') {
      const rows = await this.dataSource.query(
        `SELECT category_id FROM erp_goods_receipts WHERE id = $1`,
        [entityId],
      );
      categoryId = rows[0]?.category_id || null;
    } else if (upperType === 'GOODS_ISSUE' || upperType === 'ISSUE') {
      const rows = await this.dataSource.query(
        `SELECT category_id FROM erp_goods_issues WHERE id = $1`,
        [entityId],
      );
      categoryId = rows[0]?.category_id || null;
    } else if (
      upperType === 'INVENTORY_ADJUSTMENT' ||
      upperType === 'ADJUSTMENT'
    ) {
      const rows = await this.dataSource.query(
        `SELECT category_id FROM erp_inventory_adjustments WHERE id = $1`,
        [entityId],
      );
      categoryId = rows[0]?.category_id || null;
    }

    // 2. Lấy giá trị thuộc tính từ erp_entity_attribute_values
    const entityValues = await this.entityAttrValueRepo.find({
      where: { entityType: upperType, entityId },
      relations: { attrDef: true },
    });

    // Nếu chưa có categoryId từ entity table, lấy từ entity_attribute_values nếu có
    if (!categoryId && entityValues.length > 0) {
      const catVal = entityValues.find((ev) => ev.categoryId);
      if (catVal?.categoryId) {
        categoryId = catVal.categoryId;
      }
    }

    // 3. Category và Category Attribute Defs
    let category: ErpModuleCategory | null = null;
    if (categoryId) {
      category = await this.categoryRepo.findOne({
        where: { id: categoryId, isDeleted: false },
        relations: { attributeDefs: true },
      });
      if (category && category.attributeDefs) {
        category.attributeDefs = category.attributeDefs
          .filter((d) => !d.isDeleted && !d.isGlobal)
          .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
      }
    }

    // 4. Global Attribute Defs for this module
    const globalAttributeDefs = await this.attrDefRepo.find({
      where: {
        isGlobal: true,
        moduleKeyGlobal: upperType,
        isDeleted: false,
      },
      order: { sortOrder: 'ASC', createdAt: 'ASC' },
    });

    // 5. Tách giá trị thành category attributes và global attributes
    const attributes: Record<string, any> = {};
    const globalAttributes: Record<string, any> = {};
    const globalDefIds = new Set(globalAttributeDefs.map((g) => g.id));

    for (const ev of entityValues) {
      if (globalDefIds.has(ev.attrDefId) || ev.attrDef?.isGlobal) {
        globalAttributes[ev.attrDefId] = ev.valueText;
      } else {
        attributes[ev.attrDefId] = ev.valueText;
      }
    }

    return {
      entityType: upperType,
      entityId,
      categoryId,
      category,
      attributes,
      globalAttributes,
      globalAttributeDefs: globalAttributeDefs.map((d) => ({
        ...d,
        isActive: d.isActive,
      })),
      attributeValues: entityValues.map((ev) => ({
        id: ev.id,
        attrDefId: ev.attrDefId,
        attrCode: ev.attrDef?.code,
        attrName: ev.attrDef?.name,
        nameEn: ev.attrDef?.nameEn,
        fieldType: ev.attrDef?.fieldType,
        valueText: ev.valueText,
        isGlobal: ev.attrDef?.isGlobal || globalDefIds.has(ev.attrDefId),
      })),
    };
  }

  /**
   * Lưu cấu hình custom fields (category + attributes + globalAttributes) cho một entity bất kỳ
   */
  async saveEntityValues(
    entityType: string,
    entityId: string,
    dto: SaveEntityValuesDto,
  ) {
    const upperType = entityType.trim().toUpperCase();
    const { categoryId, attributes = {}, globalAttributes = {} } = dto;

    return this.dataSource.transaction(async (manager) => {
      // 1. Check required GLOBAL attributes (Soft check without throwing exception)
      const globalDefs = await manager.find(ErpModuleAttributeDef, {
        where: {
          isGlobal: true,
          moduleKeyGlobal: upperType,
          isDeleted: false,
        },
      });

      const globalDefMap = new Map<string, string>();
      for (const d of globalDefs) {
        globalDefMap.set(d.id, d.id);
        if (d.code) {
          globalDefMap.set(d.code.toLowerCase(), d.id);
        }
      }

      // 2. Check required CATEGORY attributes nếu có categoryId
      let catDefMap = new Map<string, string>();
      if (categoryId) {
        const cat = await manager.findOne(ErpModuleCategory, {
          where: { id: categoryId, isDeleted: false },
          relations: { attributeDefs: true },
        });
        if (!cat) {
          throw new NotFoundException(
            `Không tìm thấy danh mục ID ${categoryId}`,
          );
        }
        for (const d of cat.attributeDefs || []) {
          if (!d.isDeleted) {
            catDefMap.set(d.id, d.id);
            if (d.code) {
              catDefMap.set(d.code.toLowerCase(), d.id);
            }
          }
        }
      }

      // 3. Cập nhật category_id trên entity table
      if (
        upperType === 'INVOICE' ||
        upperType === 'INVOICE_IN' ||
        upperType === 'INVOICE_OUT'
      ) {
        await manager.query(
          `UPDATE erp_invoices SET category_id = $1, updated_at = now() WHERE id = $2`,
          [categoryId || null, entityId],
        );
      } else if (upperType === 'BANK_TXN') {
        await manager.query(
          `UPDATE erp_bank_transactions SET category_id = $1, updated_at = now() WHERE id = $2`,
          [categoryId || null, entityId],
        );
      } else if (upperType === 'BOM') {
        const prodOrderCount = await manager.query(
          `SELECT COUNT(1) as count FROM erp_production_orders WHERE is_deleted = false AND (output_metadata->>'bomId' = $1 OR (output_metadata IS NULL AND finished_good_item_id = (SELECT finished_good_item_id FROM erp_boms WHERE id = $1)))`,
          [entityId],
        );
        if ((parseInt(prodOrderCount[0]?.count, 10) || 0) > 0) {
          throw new BadRequestException(
            'BOM đã phát sinh lệnh sản xuất, không thể chỉnh sửa thuộc tính.',
          );
        }
        await manager.query(
          `UPDATE erp_boms SET category_id = $1, updated_at = now() WHERE id = $2`,
          [categoryId || null, entityId],
        );
        if (globalAttributes && typeof globalAttributes === 'object') {
          const versionAttrId = globalDefMap.get('version');
          const versionVal =
            globalAttributes.version ??
            (versionAttrId ? globalAttributes[versionAttrId] : undefined);
          if (
            versionVal !== undefined &&
            versionVal !== null &&
            String(versionVal).trim() !== ''
          ) {
            await manager.query(
              `UPDATE erp_boms SET version = $1, updated_at = now() WHERE id = $2`,
              [String(versionVal).trim(), entityId],
            );
          }
        }
      } else if (upperType === 'GOODS_RECEIPT' || upperType === 'RECEIPT') {
        await manager.query(
          `UPDATE erp_goods_receipts SET category_id = $1, updated_at = now() WHERE id = $2`,
          [categoryId || null, entityId],
        );
      } else if (upperType === 'GOODS_ISSUE' || upperType === 'ISSUE') {
        await manager.query(
          `UPDATE erp_goods_issues SET category_id = $1, updated_at = now() WHERE id = $2`,
          [categoryId || null, entityId],
        );
      } else if (
        upperType === 'INVENTORY_ADJUSTMENT' ||
        upperType === 'ADJUSTMENT'
      ) {
        await manager.query(
          `UPDATE erp_inventory_adjustments SET category_id = $1, updated_at = now() WHERE id = $2`,
          [categoryId || null, entityId],
        );
      }

      // 4. Xóa các giá trị cũ
      await manager.delete(ErpEntityAttributeValue, {
        entityType: upperType,
        entityId,
      });

      // 5. Lưu các giá trị mới
      const newEntities: ErpEntityAttributeValue[] = [];

      // Category attributes
      if (categoryId && attributes && Object.keys(attributes).length > 0) {
        for (const [key, val] of Object.entries(attributes)) {
          if (val !== undefined && val !== null && val !== '') {
            const attrDefId =
              catDefMap.get(key) || catDefMap.get(key.toLowerCase()) || key;
            const entityVal = manager.create(ErpEntityAttributeValue, {
              entityType: upperType,
              entityId,
              categoryId,
              attrDefId,
              valueText: String(val),
            });
            newEntities.push(entityVal);
          }
        }
      }

      // Global attributes (categoryId = null)
      if (globalAttributes && Object.keys(globalAttributes).length > 0) {
        for (const [key, val] of Object.entries(globalAttributes)) {
          if (val !== undefined && val !== null && val !== '') {
            const attrDefId =
              globalDefMap.get(key) ||
              globalDefMap.get(key.toLowerCase()) ||
              key;
            const entityVal = manager.create(ErpEntityAttributeValue, {
              entityType: upperType,
              entityId,
              categoryId: null,
              attrDefId,
              valueText: String(val),
            });
            newEntities.push(entityVal);
          }
        }
      }

      if (newEntities.length > 0) {
        await manager.save(ErpEntityAttributeValue, newEntities);
      }
    });
  }
}
