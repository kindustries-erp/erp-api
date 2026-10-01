import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { KgaraCase } from '../entities/kgara_case.entity';
import { KgaraCaseSettlement } from '../entities/kgara_case_settlement.entity';
import { KgaraGrossProfit } from '../entities/kgara_gross_profit.entity';
import { KgaraClientService } from '../kgara-client.service';
import { extractNetPayableAmount } from '../utils/kgara-parser.util';
import { EntityCustomFieldsHelper } from '../../module-config/helpers/entity-custom-fields.helper';

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Injectable()
export class KgaraCaseLookupService {
  constructor(
    @InjectRepository(KgaraCase)
    private readonly caseRepo: Repository<KgaraCase>,
    @InjectRepository(KgaraCaseSettlement)
    private readonly settlementRepo: Repository<KgaraCaseSettlement>,
    @InjectRepository(KgaraGrossProfit)
    private readonly grossProfitRepo: Repository<KgaraGrossProfit>,
    private readonly client: KgaraClientService,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Tra cứu chi tiết vụ việc theo Mã chứng từ (soChungTu), UUID nội bộ (id), hoặc ID KGara (hdPhieuDichVuId)
   */
  async findCaseByCodeOrId(codeOrId: string): Promise<KgaraCase> {
    const isUuid = UUID_REGEX.test(codeOrId);
    const whereConditions = isUuid
      ? [
          { id: codeOrId },
          { soChungTu: codeOrId },
          { hdPhieuDichVuId: codeOrId },
        ]
      : [{ soChungTu: codeOrId }, { hdPhieuDichVuId: codeOrId }];

    const caseData = await this.caseRepo.findOne({
      where: whereConditions,
      relations: ['category'],
    });

    if (!caseData) {
      throw new NotFoundException(`Case with code ${codeOrId} not found`);
    }

    if (
      !caseData.rawData?.ListPhieuDichVuChiTiet &&
      !caseData.rawData?.HoaDonChiTiet
    ) {
      const freshData = await this.client.getCaseDetail(
        caseData.hdPhieuDichVuId,
        caseData.branchExternalId!,
      );
      if (freshData) {
        const payload = freshData.data || freshData;
        caseData.rawData = { ...caseData.rawData, ...payload };
        const netPayable = extractNetPayableAmount(payload);
        if (netPayable > 0) {
          caseData.tienCoThue = netPayable;
          const settlements = await this.settlementRepo.find({
            where: { caseId: caseData.id },
          });
          const totalReceipts = settlements
            .filter((s) => s.settlementType === 'RECEIPT')
            .reduce((sum, s) => sum + Number(s.amount || 0), 0);
          caseData.tienDaThanhToan = totalReceipts;
          caseData.tienConPhaiThanhToan = Math.max(
            0,
            netPayable - totalReceipts,
          );
        }
        await this.caseRepo.save(caseData);
      }
    }

    await EntityCustomFieldsHelper.enrichOne(
      this.dataSource,
      'GARAGE_CASE',
      caseData,
    );

    return caseData;
  }

  /**
   * Tra cứu nhanh Lãi gộp theo Mã chứng từ (vuViecCode / soChungTu) hoặc UUID nội bộ (id)
   */
  async findGrossProfitByCodeOrId(codeOrId: string): Promise<any> {
    const isUuid = UUID_REGEX.test(codeOrId);
    let grossProfit: KgaraGrossProfit | null = null;
    let targetCase: KgaraCase | null = null;

    if (isUuid) {
      targetCase = await this.caseRepo.findOne({
        where: [
          { id: codeOrId },
          { soChungTu: codeOrId },
          { hdPhieuDichVuId: codeOrId },
        ],
      });
      if (targetCase) {
        const gpConditions: Array<{
          vuViecCode?: string;
          hdPhieuDichVuId?: string;
        }> = [];
        if (targetCase.soChungTu) {
          gpConditions.push({ vuViecCode: targetCase.soChungTu });
        }
        if (targetCase.hdPhieuDichVuId) {
          gpConditions.push({ hdPhieuDichVuId: targetCase.hdPhieuDichVuId });
        }
        if (gpConditions.length > 0) {
          grossProfit = await this.grossProfitRepo.findOne({
            where: gpConditions,
          });
        }
      }
    } else {
      grossProfit = await this.grossProfitRepo.findOne({
        where: { vuViecCode: codeOrId },
      });
      if (!grossProfit) {
        targetCase = await this.caseRepo.findOne({
          where: { soChungTu: codeOrId },
        });
      }
    }

    if (!grossProfit) {
      if (targetCase) {
        const rev = Number(
          targetCase.doanhThu ?? targetCase.rawData?.DoanhThu ?? 0,
        );
        const cost = Number(
          targetCase.chiPhi ?? targetCase.rawData?.ChiPhi ?? 0,
        );
        const profit = Number(
          targetCase.loiNhuan ?? targetCase.rawData?.LoiNhuan ?? rev - cost,
        );
        const margin = rev > 0 ? Number(((profit / rev) * 100).toFixed(1)) : 0;
        return {
          id: null,
          DoanhThu: rev,
          ChiPhi: cost,
          LoiNhuan: profit,
          BienLoiNhuan: margin,
          VuViecCode: targetCase.soChungTu || codeOrId,
          VuViecName: null,
          VuViecID: targetCase.hdPhieuDichVuId,
          ...(targetCase.rawData as object),
        };
      }
      return {
        id: null,
        DoanhThu: 0,
        ChiPhi: 0,
        LoiNhuan: 0,
        BienLoiNhuan: 0,
        VuViecCode: codeOrId,
        VuViecName: null,
        VuViecID: null,
      };
    }

    const rev = Number(grossProfit.doanhThu) || 0;
    const cost = Number(grossProfit.chiPhi) || 0;
    const profit = Number(grossProfit.loiNhuan) || rev - cost;
    const margin = rev > 0 ? Number(((profit / rev) * 100).toFixed(1)) : 0;

    return {
      id: grossProfit.id,
      createdAt: grossProfit.createdAt,
      updatedAt: grossProfit.updatedAt,
      DoanhThu: rev,
      ChiPhi: cost,
      LoiNhuan: profit,
      BienLoiNhuan: margin,
      VuViecCode: grossProfit.vuViecCode,
      VuViecName: grossProfit.vuViecName,
      TenKhachHang: grossProfit.tenKhachHang,
      VuViecID: grossProfit.hdPhieuDichVuId,
      ...(grossProfit.rawData as object),
    };
  }
}
