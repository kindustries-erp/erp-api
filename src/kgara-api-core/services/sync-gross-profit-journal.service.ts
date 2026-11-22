import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { KgaraGrossProfit } from '../entities/kgara_gross_profit.entity';
import { KgaraClientService } from '../kgara-client.service';
import { KgaraAccountKey } from '../enums/kgara-account.enum';

export interface SyncJournalResult {
  vuViecs: number;
  updated: number;
  noItems: number;
  notStored: number;
}

/**
 * Lưu journal TK 1541 của lãi gộp theo kỳ vào kgara_gross_profit.raw_data.journal_items.
 * Journal trả về KHÔNG có VuViecID nên ghép theo VuViecCode trong cùng chi nhánh.
 * Chỉ merge key journal_items, không thay toàn bộ raw_data.
 */
@Injectable()
export class SyncGrossProfitJournalService {
  private readonly logger = new Logger(SyncGrossProfitJournalService.name);

  constructor(
    @InjectRepository(KgaraGrossProfit)
    private readonly grossProfitRepo: Repository<KgaraGrossProfit>,
    private readonly client: KgaraClientService,
  ) {}

  async syncJournalForRange(
    branchExternalId: string,
    from: string,
    to: string,
    accountKey: KgaraAccountKey = KgaraAccountKey.MAIN,
  ): Promise<SyncJournalResult> {
    const result: SyncJournalResult = {
      vuViecs: 0,
      updated: 0,
      noItems: 0,
      notStored: 0,
    };

    let response: any;
    try {
      response = await this.client.getGrossProfitJournal(
        branchExternalId,
        from,
        to,
        undefined,
        accountKey,
      );
    } catch (err: any) {
      if (/Kgara API Error: 404/.test(String(err?.message))) {
        this.logger.log(
          `No journal for branch ${branchExternalId} ${from}..${to} (404, treated as empty)`,
        );
        return result;
      }
      throw err;
    }

    if (response?.status === 404) {
      this.logger.log(
        `No journal for branch ${branchExternalId} ${from}..${to} (404 in body, treated as empty)`,
      );
      return result;
    }
    if (response?.status && response.status !== 200) {
      throw new Error(
        `Kgara journal ${from}..${to} trả lỗi ${response.status}: ${response.message ?? ''}`,
      );
    }

    const vuViecs: any[] = response?.results?.VuViecs ?? [];
    result.vuViecs = vuViecs.length;

    for (const vv of vuViecs) {
      if (
        !vv?.VuViecCode ||
        !Array.isArray(vv.Items) ||
        vv.Items.length === 0
      ) {
        result.noItems++;
        continue;
      }
      const res = await this.grossProfitRepo
        .createQueryBuilder()
        .update(KgaraGrossProfit)
        .set({
          rawData: () =>
            "COALESCE(raw_data, '{}'::jsonb) || jsonb_build_object('journal_items', CAST(:journalItems AS jsonb))",
        })
        .setParameters({ journalItems: JSON.stringify(vv.Items) })
        .where('branch_external_id = :branchId AND vu_viec_code = :code', {
          branchId: branchExternalId,
          code: vv.VuViecCode,
        })
        .execute();

      if (res.affected && res.affected > 0) {
        result.updated += res.affected;
      } else {
        result.notStored++;
      }
    }

    this.logger.log(
      `Journal ${branchExternalId} ${from}..${to}: vuViecs=${result.vuViecs} updated=${result.updated} noItems=${result.noItems} notStored=${result.notStored}`,
    );
    return result;
  }
}
