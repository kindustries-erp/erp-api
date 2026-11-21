import { Injectable, Logger, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { KgaraGrossProfit } from '../entities/kgara_gross_profit.entity';
import { KgaraClientService } from '../kgara-client.service';
import { parseSafeDate } from '../utils/kgara-parser.util';
import { KgaraAccountKey } from '../enums/kgara-account.enum';
import { SyncGrossProfitJournalService } from './sync-gross-profit-journal.service';
import { KgaraCaseFinalizeService } from './kgara-case-finalize.service';

export interface GrossProfitSyncStats {
  journalCases: number;
  enrichedCases: number;
  projected: number;
  failed: number;
}

@Injectable()
export class SyncGrossProfitService {
  private readonly logger = new Logger(SyncGrossProfitService.name);

  constructor(
    @InjectRepository(KgaraGrossProfit)
    private readonly grossProfitRepo: Repository<KgaraGrossProfit>,
    private readonly client: KgaraClientService,
    private readonly journalSync: SyncGrossProfitJournalService,
    @Optional()
    private readonly finalizer?: KgaraCaseFinalizeService,
  ) {}

  /**
   * Upsert một dòng lãi gộp. Giữ nguyên rawData.journal_items đã lưu
   * (journal là dữ liệu riêng, không được xóa khi sync lãi gộp).
   */
  async persistItem(
    item: any,
    branchExternalId: string,
    range: { from: string; to: string },
  ): Promise<void> {
    const existing = await this.grossProfitRepo
      .createQueryBuilder('gp')
      .select("gp.raw_data -> 'journal_items'", 'journal')
      .where('gp.hd_phieu_dich_vu_id = :id', { id: item.VuViecID })
      .getRawOne<{ journal: unknown }>();

    const rawData = existing?.journal
      ? { ...item, journal_items: existing.journal }
      : item;

    await this.grossProfitRepo.upsert(
      {
        hdPhieuDichVuId: item.VuViecID,
        branchExternalId,
        vuViecCode: item.VuViecCode,
        vuViecName: item.VuViecName,
        tenKhachHang: item.TenKhachHang,
        doanhThu: item.DoanhThu,
        chiPhi: item.ChiPhi,
        loiNhuan: item.LoiNhuan,
        reportFrom: range.from,
        reportTo: range.to,
        rawData,
      },
      ['hdPhieuDichVuId'],
    );
  }

  async syncGrossProfitForBranch(
    branchExternalId: string,
    from?: string,
    to?: string,
    accountKey: KgaraAccountKey = KgaraAccountKey.MAIN,
  ): Promise<GrossProfitSyncStats> {
    const stats: GrossProfitSyncStats = {
      journalCases: 0,
      enrichedCases: 0,
      projected: 0,
      failed: 0,
    };
    this.logger.log(
      `Syncing gross profit ONLY for branch ${branchExternalId} (account: ${accountKey})...`,
    );
    try {
      const monthsToSync = new Set<string>();
      const parsedFrom = parseSafeDate(from);
      const parsedTo = parseSafeDate(to);

      if (parsedFrom && parsedTo) {
        let curr = new Date(parsedFrom.getFullYear(), parsedFrom.getMonth(), 1);
        const endMonth = new Date(
          parsedTo.getFullYear(),
          parsedTo.getMonth(),
          1,
        );
        while (curr <= endMonth) {
          monthsToSync.add(
            `${curr.getFullYear()}-${String(curr.getMonth() + 1).padStart(2, '0')}`,
          );
          curr = new Date(curr.getFullYear(), curr.getMonth() + 1, 1);
        }
      } else {
        const now = new Date();
        for (let i = 2; i >= 0; i--) {
          const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
          monthsToSync.add(
            `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
          );
        }
      }

      const dateRangesToSync: { from: string; to: string }[] = [];
      for (const yyyyMm of Array.from(monthsToSync).sort()) {
        const [y, m] = yyyyMm.split('-');
        const fd = new Date(Number(y), Number(m) - 1, 1).toLocaleDateString(
          'en-CA',
        );
        const ld = new Date(Number(y), Number(m), 0).toLocaleDateString(
          'en-CA',
        );
        dateRangesToSync.push({ from: fd, to: ld });
      }

      for (const range of dateRangesToSync) {
        const profitResponse = await this.client.getGrossProfitDetail(
          branchExternalId,
          range.from,
          range.to,
          accountKey,
        );

        const results = profitResponse?.results;
        if (results?.Groups) {
          for (const group of results.Groups) {
            if (group.Items) {
              for (const item of group.Items) {
                if (item.VuViecID) {
                  await this.persistItem(item, branchExternalId, range);
                }
              }
            }
          }
        }
        try {
          await this.journalSync.syncJournalForRange(
            branchExternalId,
            range.from,
            range.to,
            accountKey,
          );
          if (this.finalizer) {
            const fin = await this.finalizer.finalizePeriod(
              branchExternalId,
              range.from,
              range.to,
            );
            stats.journalCases += fin.journalCases;
            stats.enrichedCases += fin.enrichedCases;
            stats.projected += fin.enrichedCases;
            stats.failed += fin.failed;
          }
        } catch (journalErr: any) {
          this.logger.warn(
            `Journal/cost finalize failed for ${branchExternalId} ${range.from}..${range.to}: ${journalErr?.message}`,
          );
        }
        this.logger.log(
          `Synced gross profit for branch ${branchExternalId} from ${range.from} to ${range.to}`,
        );
      }
      return stats;
    } catch (err: any) {
      this.logger.error(`Failed to sync gross profit: ${err.message}`);
      throw err;
    }
  }
}
