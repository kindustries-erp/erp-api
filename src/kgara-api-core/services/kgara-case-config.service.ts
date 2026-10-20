import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { KgaraCase } from '../entities/kgara_case.entity';
import { ErpModuleCategory } from '../../module-config/entities/erp_module_category.entity';
import { EntityCustomFieldsHelper } from '../../module-config/helpers/entity-custom-fields.helper';
import { StrictCustomFieldsHelper } from '../../module-config/helpers/strict-custom-fields.helper';
import { GARAGE_CASE_SEMANTIC } from '../../module-config/registry/module-field-registry';
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
          caseData.category = cat;
          // Nhận diện OJ theo semanticKey (code admin sửa được); giữ giá trị classification cũ cho báo cáo
          caseData.classification =
            cat.semanticKey === GARAGE_CASE_SEMANTIC.OJ ||
            cat.code === 'OJ_NGOAI'
              ? 'OJ'
              : cat.code;
        } else {
          caseData.categoryId = resolvedCategoryId;
        }
      } else {
        caseData.categoryId = null;
        caseData.category = null as any;
        // Bỏ phân loại: client gửi classification null/rỗng (hoặc không gửi) → xóa cả hai, tránh UI vẫn hiện theo classification cũ
        if (!resolvedClassification) {
          caseData.classification = null;
          // Chủ động bỏ phân loại: chặn sync KGara tự gán lại
          caseData.classificationManuallyCleared = true;
        }
      }
    } else if (resolvedClassification !== undefined) {
      if (resolvedClassification) {
        const normalizedClass =
          resolvedClassification === 'OJ_NGOAI' ? 'OJ' : resolvedClassification;
        const cat = await this.categoryRepo.findOne({
          where: [
            ...(normalizedClass === 'OJ'
              ? [
                  {
                    semanticKey: GARAGE_CASE_SEMANTIC.OJ,
                    moduleKey: 'GARAGE_CASE',
                  },
                ]
              : []),
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
        caseData.classificationManuallyCleared = true;
      }
    }

    // Đã có phân loại (do người dùng chọn lại) thì gỡ cờ khóa sync
    if (caseData.classification) {
      caseData.classificationManuallyCleared = false;
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

    // 4. Chỉ thuộc tính TÙY CHỈNH đi qua EAV; cờ loại trừ/category là built-in (cột kgara_cases, nguồn duy nhất)
    const customAttrsToSave: Record<string, any> = {
      ...(dto.globalAttributes || {}),
      ...(dto.attributes || {}),
      ...(dto.customAttributes || {}),
    };

    // 5. Lưu dữ liệu trong Transaction an toàn
    await this.dataSource.transaction(async (manager) => {
      await manager.save(KgaraCase, caseData);

      if (Object.keys(customAttrsToSave).length > 0) {
        await StrictCustomFieldsHelper.saveInTx(
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
