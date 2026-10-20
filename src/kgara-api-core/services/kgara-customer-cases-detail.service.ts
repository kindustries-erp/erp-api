import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { KgaraCase } from '../entities/kgara_case.entity';
import { KgaraCaseSettlement } from '../entities/kgara_case_settlement.entity';
import { KgaraGrossProfit } from '../entities/kgara_gross_profit.entity';
import { extractNetPayableAmount } from '../kgara-sync.service';

export interface EnrichedCustomerCaseItem extends Record<string, any> {
  id: string;
  soChungTu: string | null;
  bienSoXe: string | null;
  ngayHoanThanhCongViec: Date | string | null;
  ngayPhatSinh: Date | string | null;
  tienCoThue: number;
  tienDaThanhToan: number;
  tienConPhaiThanhToan: number;
  chiPhi: number;
  tienDaChi: number;
  tienConPhaiChi: number;
  agingDays: number;
  isCompleted: boolean;
}

@Injectable()
export class KgaraCustomerCasesDetailService {
  constructor(
    @InjectRepository(KgaraCase)
    private readonly caseRepo: Repository<KgaraCase>,
    @InjectRepository(KgaraCaseSettlement)
    private readonly settlementRepo: Repository<KgaraCaseSettlement>,
    @InjectRepository(KgaraGrossProfit)
    private readonly grossProfitRepo: Repository<KgaraGrossProfit>,
  ) {}

  async getCasesByCustomer(
    branchId: string,
    customerCode: string,
    licensePlate?: string,
  ): Promise<EnrichedCustomerCaseItem[]> {
    const query = this.caseRepo
      .createQueryBuilder('case')
      .where('case.kgaraDeletedAt IS NULL')
      .andWhere('case.excludeFromReports IS NOT TRUE')
      .andWhere('case.excludeFromDebt IS NOT TRUE')
      .andWhere(
        '(case.ngayHoanThanhCongViec >= :baselineDate OR case.ngayPhatSinh >= :baselineDate OR case.createdAt >= :baselineDate)',
        { baselineDate: '2026-07-01' },
      );

    if (customerCode === 'UNKNOWN' || customerCode === 'NO_CODE') {
      query.andWhere('case.khachHangCode IS NULL');
    } else {
      query.andWhere('case.khachHangCode = :customerCode', { customerCode });
    }

    if (branchId) {
      query.andWhere('case.branchExternalId = :branchId', { branchId });
    }

    if (
      licensePlate &&
      licensePlate.trim() &&
      licensePlate.trim().toUpperCase() !== 'ALL'
    ) {
      query.andWhere('case.bienSoXe = :licensePlate', {
        licensePlate: licensePlate.trim(),
      });
    }

    query.orderBy('case.ngayHoanThanhCongViec', 'DESC', 'NULLS LAST');
    query.addOrderBy('case.ngayPhatSinh', 'DESC', 'NULLS LAST');

    const cases = await query.getMany();
    const caseIds = cases.map((item) => item.id).filter(Boolean);
    const caseCodes = cases.map((item) => item.soChungTu).filter(Boolean);

    const settlementsMap: Record<
      string,
      { receipts: number; payments: number }
    > = {};

    if (caseIds.length > 0) {
      const settlementRows = await this.settlementRepo
        .createQueryBuilder('s')
        .select('s.caseId', 'caseId')
        .addSelect('s.settlementType', 'settlementType')
        .addSelect('SUM(s.amount)', 'totalAmount')
        .where('s.caseId IN (:...caseIds)', { caseIds })
        .groupBy('s.caseId')
        .addGroupBy('s.settlementType')
        .getRawMany();

      for (const row of settlementRows) {
        if (!settlementsMap[row.caseId]) {
          settlementsMap[row.caseId] = { receipts: 0, payments: 0 };
        }
        if (row.settlementType === 'RECEIPT') {
          settlementsMap[row.caseId].receipts += Number(row.totalAmount || 0);
        } else if (row.settlementType === 'PAYMENT') {
          settlementsMap[row.caseId].payments += Number(row.totalAmount || 0);
        }
      }
    }

    const gpMap = new Map<string, number>();
    if (caseCodes.length > 0) {
      const gpRows = await this.grossProfitRepo
        .createQueryBuilder('gp')
        .select('gp.vuViecCode', 'vuViecCode')
        .addSelect('gp.chiPhi', 'chiPhi')
        .where('gp.vuViecCode IN (:...caseCodes)', { caseCodes })
        .getRawMany();

      for (const row of gpRows) {
        if (row.vuViecCode) {
          gpMap.set(row.vuViecCode, Number(row.chiPhi) || 0);
        }
      }
    }

    const today = new Date();

    return cases.map((c) => {
      const isCompleted = Boolean(
        c.ngayHoanThanhCongViec &&
        (c.tinhTrangDichVu === 3 ||
          c.tenTinhTrangDichVu === 'Kết thúc' ||
          (c.tenTinhTrangDichVu &&
            c.tenTinhTrangDichVu.toLowerCase().includes('kết thúc')) ||
          (c.tenTinhTrangDichVu &&
            c.tenTinhTrangDichVu.toLowerCase().includes('hoàn tất'))),
      );

      let agingDays = 0;
      if (isCompleted && c.ngayHoanThanhCongViec) {
        const cDate = new Date(c.ngayHoanThanhCongViec);
        const diffTime = Math.abs(today.getTime() - cDate.getTime());
        agingDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      }

      const setInfo = settlementsMap[c.id];
      const hasSettlement = setInfo !== undefined;
      const targetRev = extractNetPayableAmount(c);
      const totalPaid = hasSettlement
        ? setInfo.receipts
        : Number(c.tienDaThanhToan) || 0;
      const remainingBal = Math.max(0, targetRev - totalPaid);

      // Nhóm Phải trả (Payables)
      const gpCost = c.soChungTu ? gpMap.get(c.soChungTu) : undefined;
      const costAmount = gpCost !== undefined ? gpCost : Number(c.chiPhi) || 0;
      const paidCost = setInfo ? setInfo.payments : 0;
      const balanceCost = costAmount - paidCost;

      return {
        ...c,
        isCompleted,
        agingDays,
        tienCoThue: targetRev,
        tienDaThanhToan: totalPaid,
        tienConPhaiThanhToan: remainingBal,
        chiPhi: costAmount,
        tienDaChi: paidCost,
        tienConPhaiChi: balanceCost,
      };
    });
  }
}
