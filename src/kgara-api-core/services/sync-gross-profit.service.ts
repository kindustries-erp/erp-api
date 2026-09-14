import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { KgaraGrossProfit } from '../entities/kgara_gross_profit.entity';
import { KgaraClientService } from '../kgara-client.service';
import { parseSafeDate } from '../utils/kgara-parser.util';

@Injectable()
export class SyncGrossProfitService {
  private readonly logger = new Logger(SyncGrossProfitService.name);

  constructor(
    @InjectRepository(KgaraGrossProfit)
    private readonly grossProfitRepo: Repository<KgaraGrossProfit>,
    private readonly client: KgaraClientService,
  ) {}

  async syncGrossProfitForBranch(
    branchExternalId: string,
    from?: string,
    to?: string,
  ): Promise<void> {
    this.logger.log(
      `Syncing gross profit ONLY for branch ${branchExternalId}...`,
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
        );

        const results = profitResponse?.results;
        if (results?.Groups) {
          for (const group of results.Groups) {
            if (group.Items) {
              for (const item of group.Items) {
                if (item.VuViecID) {
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
                      rawData: item,
                    },
                    ['hdPhieuDichVuId'],
                  );
                }
              }
            }
          }
        }
        this.logger.log(
          `Synced gross profit for branch ${branchExternalId} from ${range.from} to ${range.to}`,
        );
      }
    } catch (err: any) {
      this.logger.error(`Failed to sync gross profit: ${err.message}`);
      throw err;
    }
  }
}
