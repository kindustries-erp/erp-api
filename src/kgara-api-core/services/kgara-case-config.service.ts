import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { KgaraCase } from '../entities/kgara_case.entity';
import { ErpModuleCategory } from '../../module-config/entities/erp_module_category.entity';
import { EntityCustomFieldsHelper } from '../../module-config/helpers/entity-custom-fields.helper';
import { UpdateCaseConfigDto } from '../dto/update-case-config.dto';

/**
 * Sub-Service chuyên trách quản lý cấu hình, phân loại danh mục,
 * cờ loại trừ (báo cáo / công nợ) và trường tùy chỉnh động cho Vụ việc Garage.
 */
@Injectable()
export class KgaraCaseConfigService {
  private readonly logger = new Logger(KgaraCaseConfigService.name);

  constructor(
    @InjectRepository(KgaraCase)
    private readonly caseRepo: Repository<KgaraCase>,
    @InjectRepository(ErpModuleCategory)
    private readonly categoryRepo: Repository<ErpModuleCategory>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Tìm vụ việc theo UUID, số chứng từ hoặc ID gốc từ KGara
   */
  async findCaseByAnyId(id: string): Promise<KgaraCase | null> {
    const isUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        id,
      );
    const whereConditions = isUuid
      ? [{ id }, { soChungTu: id }, { hdPhieuDichVuId: id }]
      : [{ soChungTu: id }, { hdPhieuDichVuId: id }];

    return this.caseRepo.findOne({
      where: whereConditions,
      relations: ['category'],
    });
  }

  /**
   * Cập nhật cấu hình vụ việc: Phân loại danh mục, Cờ loại trừ, Ghi chú & Custom Attributes
   */
  async updateCaseConfig(
    id: string,
    dto: UpdateCaseConfigDto,
  ): Promise<KgaraCase> {
    const caseData = await this.findCaseByAnyId(id);
    if (!caseData) {
      throw new NotFoundException(`Case with id ${id} not found`);
    }

    // 1. Phân giải Category & Classification
    let resolvedCategoryId = dto.categoryId;
    let resolvedClassification = dto.classification;

    if (resolvedCategoryId !== undefined) {
      if (resolvedCategoryId) {
        const cat = await this.categoryRepo.findOne({
          where: { id: resolvedCategoryId, moduleKey: 'GARAGE_CASE' },
        });
        if (cat) {
          caseData.categoryId = cat.id;
          caseData.classification = cat.code === 'OJ_NGOAI' ? 'OJ' : cat.code;
        } else {
          caseData.categoryId = resolvedCategoryId;
        }
      } else {
        caseData.categoryId = null;
        if (resolvedClassification === undefined) {
          caseData.classification = null;
        }
      }
    } else if (resolvedClassification !== undefined) {
      if (resolvedClassification) {
        const normalizedClass =
          resolvedClassification === 'OJ_NGOAI' ? 'OJ' : resolvedClassification;
        const cat = await this.categoryRepo.findOne({
          where: [
            { code: normalizedClass, moduleKey: 'GARAGE_CASE' },
            {
              code: normalizedClass === 'OJ' ? 'OJ_NGOAI' : normalizedClass,
              moduleKey: 'GARAGE_CASE',
            },
          ],
        });
        caseData.classification = normalizedClass;
        if (cat) {
          caseData.categoryId = cat.id;
        }
      } else {
        caseData.classification = null;
        caseData.categoryId = null;
      }
    }

    if (caseData.classification === 'OJ_NGOAI') {
      caseData.classification = 'OJ';
    }

    // 2. Cập nhật các cờ loại trừ
    if (dto.excludeFromReports !== undefined) {
      caseData.excludeFromReports = dto.excludeFromReports;
    }
    if (dto.excludeFromDebt !== undefined) {
      caseData.excludeFromDebt = dto.excludeFromDebt;
    } else if (caseData.classification === 'OJ') {
      // Tự động kích hoạt loại trừ công nợ cho phân loại Xe ngoài (OJ) nếu chưa được chỉ định
      caseData.excludeFromDebt = true;
    }

    // 3. Cập nhật ghi chú ERP
    if (dto.erpNotes !== undefined) {
      caseData.erpNotes = dto.erpNotes;
    }

    // 4. Chuẩn bị customAttributes (Đồng bộ cả 2 cờ loại trừ vào customAttributes payload)
    const customAttrsToSave: Record<string, any> = {
      ...(dto.globalAttributes || {}),
      ...(dto.attributes || {}),
      ...(dto.customAttributes || {}),
    };
    if (dto.excludeFromReports !== undefined) {
      customAttrsToSave['exclude_from_reports'] = dto.excludeFromReports;
    }
    if (dto.excludeFromDebt !== undefined || caseData.classification === 'OJ') {
      customAttrsToSave['exclude_from_debt'] = caseData.excludeFromDebt;
    }

    // 5. Lưu dữ liệu trong Transaction an toàn
    await this.dataSource.transaction(async (manager) => {
      await manager.save(KgaraCase, caseData);

      if (Object.keys(customAttrsToSave).length > 0) {
        await EntityCustomFieldsHelper.saveInTx(
          manager,
          'GARAGE_CASE',
          caseData.id,
          customAttrsToSave,
        );
      }
    });

    // 6. Làm giàu dữ liệu EAV Custom Fields
    await EntityCustomFieldsHelper.enrichOne(
      this.dataSource,
      'GARAGE_CASE',
      caseData,
    );

    return caseData;
  }

  /**
   * Cập nhật ghi chú ERP (Legacy alias)
   */
  async updateErpNotes(
    id: string,
    erpNotes: string | null,
  ): Promise<KgaraCase> {
    return this.updateCaseConfig(id, { erpNotes });
  }
}
