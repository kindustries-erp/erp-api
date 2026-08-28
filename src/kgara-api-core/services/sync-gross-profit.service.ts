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
      const dateRangesToSync: { from: string; to: string }[] = [];
      const parsedFrom = parseSafeDate(from);
      const parsedTo = parseSafeDate(to);

      if (parsedFrom && parsedTo) {
        dateRangesToSync.push({
          from: parsedFrom.toISOString().split('T')[0],
          to: parsedTo.toISOString().split('T')[0],
        });
      } else {
        const now = new Date();
        const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
        const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        dateRangesToSync.push({
          from: firstDay.toLocaleDateString('en-CA'),
          to: lastDay.toLocaleDateString('en-CA'),
        });
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
