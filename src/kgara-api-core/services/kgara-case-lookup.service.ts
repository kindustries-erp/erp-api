import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { KgaraCase } from '../entities/kgara_case.entity';
import { KgaraCaseService } from '../entities/kgara_case_service.entity';
import { KgaraCaseSettlement } from '../entities/kgara_case_settlement.entity';
import { KgaraGrossProfit } from '../entities/kgara_gross_profit.entity';
import { KgaraClientService } from '../kgara-client.service';
import { extractNetPayableAmount } from '../utils/kgara-parser.util';
import { EntityCustomFieldsHelper } from '../../module-config/helpers/entity-custom-fields.helper';
import { KgaraCostEnricherHelper } from '../helpers/kgara-cost-enricher.helper';

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Injectable()
export class KgaraCaseLookupService {
  constructor(
    @InjectRepository(KgaraCase)
    private readonly caseRepo: Repository<KgaraCase>,
    @InjectRepository(KgaraCaseService)
    private readonly caseServiceRepo: Repository<KgaraCaseService>,
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

    await this.enrichCostForCase(caseData);

    return caseData;
  }

  /**
   * Tra cứu chi tiết vụ việc theo externalId (hdPhieuDichVuId hoặc UUID), tự động đồng bộ từ KGara nếu chưa có
   */
  async findCaseByExternalId(
    externalId: string,
    branchId?: string,
  ): Promise<KgaraCase> {
    const isUuid = UUID_REGEX.test(externalId);
    const whereConditions = isUuid
      ? [{ id: externalId }, { hdPhieuDichVuId: externalId }]
      : [{ hdPhieuDichVuId: externalId }, { soChungTu: externalId }];

    let caseData = await this.caseRepo.findOne({
      where: whereConditions,
      relations: ['category'],
    });
    if (!caseData && branchId) {
      const freshData = await this.client.getCaseDetail(externalId, branchId);
      if (freshData) {
        const payload = freshData.data || freshData;
        caseData = this.caseRepo.create({
          hdPhieuDichVuId: externalId,
          branchExternalId: branchId,
          rawData: payload,
        });
        await this.caseRepo.save(caseData);
      }
    }
    if (!caseData) {
      throw new NotFoundException(
        `Case with externalId ${externalId} not found`,
      );
    }
    await EntityCustomFieldsHelper.enrichOne(
      this.dataSource,
      'GARAGE_CASE',
      caseData,
    );
    await this.enrichCostForCase(caseData);
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

  /**
   * Tự động làm giàu đơn giá vốn & tổng vốn cho các dòng phụ tùng từ Sổ nhật ký chi phí (TK 1541)
   */
  async enrichCostForCase(caseData: KgaraCase): Promise<void> {
    const rawLines =
      caseData.rawData?.ListPhieuDichVuChiTiet ||
      caseData.rawData?.PhieuDichVuChiTiet;
    if (!rawLines || !Array.isArray(rawLines) || rawLines.length === 0) return;

    if (caseData.rawData?.costEnriched && caseData.rawData?.costBreakdown) {
      return;
    }

    try {
      const gpConditions: Array<{
        vuViecCode?: string;
        hdPhieuDichVuId?: string;
      }> = [];
      if (caseData.soChungTu) {
        gpConditions.push({ vuViecCode: caseData.soChungTu });
      }
      if (caseData.hdPhieuDichVuId) {
        gpConditions.push({ hdPhieuDichVuId: caseData.hdPhieuDichVuId });
      }

      const grossProfit =
        gpConditions.length > 0
          ? await this.grossProfitRepo.findOne({ where: gpConditions })
          : null;

      let journalItems = grossProfit?.rawData?.journal_items;

      if (!journalItems && caseData.branchExternalId) {
        let fromStr = grossProfit?.reportFrom
          ? String(grossProfit.reportFrom).slice(0, 10)
          : null;
        let toStr = grossProfit?.reportTo
          ? String(grossProfit.reportTo).slice(0, 10)
          : null;

        if (!fromStr || !toStr) {
          const date = caseData.ngayPhatSinh
            ? new Date(caseData.ngayPhatSinh)
            : new Date();
          const y = date.getFullYear();
          const m = String(date.getMonth() + 1).padStart(2, '0');
          fromStr = `${y}-${m}-01`;
          const lastDay = new Date(y, date.getMonth() + 1, 0).getDate();
          toStr = `${y}-${m}-${String(lastDay).padStart(2, '0')}`;
        }

        const vuViecID =
          grossProfit?.rawData?.VuViecID || caseData.hdPhieuDichVuId;

        const journalRes = await this.client.getGrossProfitJournal(
          caseData.branchExternalId,
          fromStr,
          toStr,
          vuViecID,
        );

        const vuViecs = journalRes?.results?.VuViecs || [];
        const matchedVuViec =
          vuViecs.find(
            (v: any) =>
              v.VuViecCode === caseData.soChungTu ||
              v.VuViecID === vuViecID ||
              v.VuViecID === caseData.hdPhieuDichVuId,
          ) || vuViecs[0];

        if (matchedVuViec?.Items) {
          journalItems = matchedVuViec.Items;
          if (grossProfit) {
            grossProfit.rawData = {
              ...(grossProfit.rawData || {}),
              journal_items: journalItems,
            };
            await this.grossProfitRepo.save(grossProfit);
          }
        }
      }

      if (journalItems && Array.isArray(journalItems)) {
        const enriched = KgaraCostEnricherHelper.enrichCaseLines(
          rawLines,
          journalItems,
        );
        caseData.rawData.ListPhieuDichVuChiTiet = enriched.lines;
        caseData.rawData.costBreakdown = enriched.costBreakdown;
        caseData.rawData.costEnriched = true;

        await this.caseRepo.save(caseData);

        for (const line of enriched.lines) {
          const detailId =
            line.HdPhieuDichVuChiTietID ||
            line.HdPhieuDichVuChiTietId ||
            line.Id;
          if (detailId && line.GiaVonPhuTung > 0) {
            await this.caseServiceRepo.update(
              { hdPhieuDichVuChiTietId: detailId },
              { giaVonPhuTung: line.GiaVonPhuTung },
            );
          }
        }
      }
    } catch {
      // Non-blocking error handling
    }
  }

  /**
   * Cập nhật giá vốn thủ công cho các dòng phụ tùng trên ERP
   */
  async updateCaseLinesCost(
    caseIdOrCode: string,
    linesCost: Array<{ detailId: string; giaVonPhuTung: number }>,
  ): Promise<KgaraCase> {
    const caseData = await this.findCaseByCodeOrId(caseIdOrCode);
    const rawLines =
      caseData.rawData?.ListPhieuDichVuChiTiet ||
      caseData.rawData?.PhieuDichVuChiTiet ||
      [];

    for (const item of linesCost) {
      const targetLine = rawLines.find(
        (l: any) =>
          (l.HdPhieuDichVuChiTietID || l.HdPhieuDichVuChiTietId || l.Id) ===
          item.detailId,
      );
      if (targetLine) {
        const unitCost = Number(item.giaVonPhuTung || 0);
        targetLine.GiaVonPhuTung = unitCost;
        targetLine.giaVonPhuTung = unitCost;
        const qty = Math.max(1, Number(targetLine.SoLuongHoaDon || 1));
        targetLine.TongVon = unitCost * qty;
        targetLine.tongVon = targetLine.TongVon;
        targetLine.CostAllocationType = 'MANUAL_ERP';
        targetLine.costAllocationType = 'MANUAL_ERP';

        await this.caseServiceRepo.update(
          { hdPhieuDichVuChiTietId: item.detailId },
          { giaVonPhuTung: unitCost },
        );
      }
    }

    caseData.rawData.ListPhieuDichVuChiTiet = rawLines;
    caseData.rawData.costEnriched = true;
    await this.caseRepo.save(caseData);
    return caseData;
  }
}
