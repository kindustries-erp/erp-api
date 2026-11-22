import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository } from 'typeorm';
import { KgaraCase } from '../entities/kgara_case.entity';
import { KgaraGrossProfit } from '../entities/kgara_gross_profit.entity';
import { KgaraCaseLookupService } from './kgara-case-lookup.service';

export interface FinalizePeriodResult {
  journalCases: number;
  enrichedCases: number;
  failed: number;
}

function shiftDay(date: string, days: number): string {
  const d = new Date(`${String(date).slice(0, 10)}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Hoàn tất dữ liệu phiếu sau sync để mọi nơi đọc (drawer, list, Excel, V2) thấy cùng số,
 * không phụ thuộc việc mở drawer. Chỉ dùng journal đã lưu, không gọi KGara từng phiếu.
 */
@Injectable()
export class KgaraCaseFinalizeService {
  private readonly logger = new Logger(KgaraCaseFinalizeService.name);

  constructor(
    @InjectRepository(KgaraGrossProfit)
    private readonly grossProfitRepo: Repository<KgaraGrossProfit>,
    @InjectRepository(KgaraCase)
    private readonly caseRepo: Repository<KgaraCase>,
    private readonly lookup: KgaraCaseLookupService,
  ) {}

  /** Một phiếu vừa sync chi tiết: làm giàu giá vốn từ journal đã lưu. Caller tự chiếu V2. */
  async finalizeCase(
    caseData: KgaraCase,
    opts: { notifyProjector?: boolean } = {},
  ): Promise<boolean> {
    return this.lookup.enrichCostForCase(caseData, {
      skipRemote: true,
      notifyProjector: opts.notifyProjector ?? false,
    });
  }

  /** Mọi phiếu của chi nhánh có journal đã lưu trong kỳ (theo report_from/report_to của lãi gộp). */
  async finalizePeriod(
    branchExternalId: string,
    from: string,
    to: string,
  ): Promise<FinalizePeriodResult> {
    const result: FinalizePeriodResult = {
      journalCases: 0,
      enrichedCases: 0,
      failed: 0,
    };

    const rows = await this.grossProfitRepo
      .createQueryBuilder('gp')
      .select('gp.vu_viec_code', 'code')
      .where('gp.branch_external_id = :branchId', {
        branchId: branchExternalId,
      })
      // report_from/report_to lưu theo giờ VN (UTC+7) nên lệch tối đa 1 ngày so với from/to dạng ngày.
      .andWhere('gp.report_from >= :from AND gp.report_to <= :to', {
        from: shiftDay(from, -1),
        to: shiftDay(to, 1),
      })
      .andWhere("gp.raw_data ? 'journal_items'")
      .getRawMany<{ code: string }>();

    // gp.hd_phieu_dich_vu_id KHÔNG trùng kgara_cases.hd_phieu_dich_vu_id; ghép theo mã chứng từ.
    const codes = rows.map((r) => r.code).filter(Boolean);
    result.journalCases = codes.length;
    if (codes.length === 0) return result;

    const cases = await this.caseRepo.find({
      where: {
        soChungTu: In(codes),
        branchExternalId,
        kgaraDeletedAt: IsNull(),
      },
    });

    for (const c of cases) {
      try {
        const enriched = await this.lookup.enrichCostForCase(c, {
          skipRemote: true,
          notifyProjector: true,
        });
        if (enriched) result.enrichedCases++;
      } catch (err: any) {
        result.failed++;
        this.logger.warn(
          `finalizePeriod failed for ${c.soChungTu || c.id}: ${err?.message || err}`,
        );
      }
    }

    this.logger.log(
      `Finalized ${branchExternalId} ${from}..${to}: journalCases=${result.journalCases} enriched=${result.enrichedCases} failed=${result.failed}`,
    );
    return result;
  }
}
