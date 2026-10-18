import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, ILike, Repository } from 'typeorm';
import { ErpModuleCategory } from '../entities/erp_module_category.entity';
import {
  ModuleAttributeOption,
  ErpModuleAttributeDef,
} from '../entities/erp_module_attribute_def.entity';
import { ErpEntityAttributeValue } from '../entities/erp_entity_attribute_value.entity';
import { CreateModuleAttrDefDto } from '../dto/create-module-attr-def.dto';
import { UpdateModuleAttrDefDto } from '../dto/update-module-attr-def.dto';

@Injectable()
export class ModuleAttributeDefService {
  constructor(
    @InjectRepository(ErpModuleAttributeDef)
    private readonly attrDefRepo: Repository<ErpModuleAttributeDef>,
    @InjectRepository(ErpModuleCategory)
    private readonly categoryRepo: Repository<ErpModuleCategory>,
    @InjectRepository(ErpEntityAttributeValue)
    private readonly entityAttrValueRepo: Repository<ErpEntityAttributeValue>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Helper validate unique options keys for SELECT field type
   */
  validateSelectOptions(options?: ModuleAttributeOption[] | null) {
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
  async getUsageCounts(defIds: string[]): Promise<Map<string, number>> {
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
   * Tạo AttributeDef mới (Có hỗ trợ parentAttrCode)
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

      // Check duplicate code in same moduleKeyGlobal
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
          `Mã thuộc tính chung "${code}" đã tồn tại trong phân hệ ${upperModuleKey}.`,
        );
      }
    } else {
      if (!dto.categoryId) {
        throw new BadRequestException(
          'Thuộc tính theo danh mục bắt buộc phải có categoryId.',
        );
      }
      const cat = await this.categoryRepo.findOne({
        where: { id: dto.categoryId, isDeleted: false },
      });
      if (!cat) {
        throw new NotFoundException(
          `Không tìm thấy danh mục ID ${dto.categoryId}`,
        );
      }

      // Check duplicate code in same category
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
      parentAttrCode: dto.parentAttrCode ? dto.parentAttrCode.trim() : null,
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
   * Cập nhật AttributeDef (Đã sửa triệt để bug lưu parentAttrCode)
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

    // Nếu thuộc tính đã có dữ liệu sử dụng: không cho phép đổi kiểu dữ liệu fieldType
    if (usageCount > 0 && dto.fieldType && dto.fieldType !== def.fieldType) {
      throw new ConflictException(
        `Thuộc tính đang được sử dụng trong ${usageCount} bản ghi thực thể, không thể thay đổi Kiểu dữ liệu.`,
      );
    }

    if (dto.code && !def.isSystem) {
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
              `Mã thuộc tính chung "${code}" đã tồn tại trong phân hệ ${def.moduleKeyGlobal}.`,
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
    if (dto.parentAttrCode !== undefined) {
      def.parentAttrCode = dto.parentAttrCode
        ? dto.parentAttrCode.trim()
        : null;
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
                'INTERNAL',
                'SHOWROOM',
                'SCRAP',
                'OTHER',
                'PURCHASE_GOODS',
                'EXPENSE_OPEX',
                'SERVICE_FEE',
                'FIXED_ASSET',
                'SALE_GOODS',
                'SALE_SERVICE',
                'SALE_FINANCIAL',
                'OTHER_INCOME',
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

    // Quét các bảng thực thể nếu là thuộc tính hệ thống hoặc liên kết trực tiếp
    const modKey = (def.moduleKeyGlobal || '').toUpperCase();
    const attrCode = (def.code || '').toLowerCase();

    if (modKey === 'GOODS_RECEIPT' && attrCode === 'category') {
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
        // Safe catch
      }
    } else if (modKey === 'GOODS_ISSUE' && attrCode === 'category') {
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
            if (
              (key === 'LOSS' ||
                key === 'SCRAP' ||
                key === 'SHOWROOM' ||
                key === 'INTERNAL_USE') &&
              usageMap['INTERNAL'] !== undefined
            ) {
              usageMap['INTERNAL'] =
                (usageMap['INTERNAL'] || 0) + Number(row.count || 0);
            } else if (
              (key === 'LOSS' || key === 'SCRAP') &&
              usageMap['SHOWROOM'] !== undefined
            ) {
              usageMap['SHOWROOM'] =
                (usageMap['SHOWROOM'] || 0) + Number(row.count || 0);
            } else if (key === 'LOSS' && usageMap['SCRAP'] !== undefined) {
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
}
