import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { KgaraCase } from '../entities/kgara_case.entity';
import { KgaraCaseSettlement } from '../entities/kgara_case_settlement.entity';
import { extractNetPayableAmount } from '../kgara-sync.service';

@Injectable()
export class KgaraCaseSettlementCalcService {
  private readonly logger = new Logger(KgaraCaseSettlementCalcService.name);

  constructor(
    @InjectRepository(KgaraCase)
    private readonly caseRepo: Repository<KgaraCase>,
    @InjectRepository(KgaraCaseSettlement)
    private readonly settlementRepo: Repository<KgaraCaseSettlement>,
  ) {}

  /**
   * Tính toán và đồng bộ lại tổng thu thực tế / công nợ còn lại của Vụ việc
   */
  async recalculateCaseSettlementSummary(caseId: string): Promise<void> {
    try {
      const c = await this.caseRepo.findOne({
        where: [
          { id: caseId },
          { soChungTu: caseId },
          { hdPhieuDichVuId: caseId },
        ],
      });
      if (!c) return;

      const settlements = await this.settlementRepo.find({
        where: { caseId: c.id },
      });

      const totalReceipts = settlements
        .filter((s) => s.settlementType === 'RECEIPT')
        .reduce((sum, s) => sum + Number(s.amount || 0), 0);

      const targetRevenue = extractNetPayableAmount(c);
      const remainingReceivable = Math.max(0, targetRevenue - totalReceipts);

      await this.caseRepo.update(c.id, {
        tienCoThue: targetRevenue,
        tienDaThanhToan: totalReceipts,
        tienConPhaiThanhToan: remainingReceivable,
      });
    } catch (err) {
      this.logger.warn(
        `Failed to recalculate case settlement summary for ${caseId}: ${err}`,
      );
    }
  }
}
