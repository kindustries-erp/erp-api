import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BankManagement } from '../entities/bank-management.entity';

interface VietQrBankItem {
  id?: number;
  name: string;
  code: string;
  bin: string;
  shortName?: string;
  short_name?: string;
  logo?: string;
  transferSupported?: number | boolean;
  lookupSupported?: number | boolean;
}

interface VietQrApiResponse {
  code: string;
  desc: string;
  data: VietQrBankItem[];
}

export interface SyncResult {
  totalFetched: number;
  insertedCount: number;
  updatedCount: number;
  syncedAt: Date;
}

@Injectable()
export class BanksManagementSyncService {
  private readonly logger = new Logger(BanksManagementSyncService.name);
  private readonly VIETQR_API_URL = 'https://api.vietqr.io/v2/banks';

  constructor(
    @InjectRepository(BankManagement)
    private readonly repo: Repository<BankManagement>,
  ) {}

  async syncFromVietQr(): Promise<SyncResult> {
    this.logger.log(
      `Fetching bank list from VietQR API: ${this.VIETQR_API_URL}`,
    );
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    try {
      const response = await fetch(this.VIETQR_API_URL, {
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`VietQR API trả về mã lỗi HTTP ${response.status}`);
      }

      const body = (await response.json()) as VietQrApiResponse;
      if (!body?.data || !Array.isArray(body.data)) {
        throw new Error(`Dữ liệu VietQR không đúng định dạng mong đợi`);
      }

      const now = new Date();
      let insertedCount = 0;
      let updatedCount = 0;

      for (const item of body.data) {
        const code = item.code?.trim().toUpperCase();
        const bin = item.bin?.trim();
        if (!code || !bin) continue;

        const shortName = item.shortName || item.short_name || code;
        const name = item.name || shortName;
        const logoUrl = item.logo || null;
        const transferSupported = Boolean(item.transferSupported);
        const lookupSupported = Boolean(item.lookupSupported);

        const existing = await this.repo.findOne({
          where: [
            { code, isDeleted: false },
            { bin, isDeleted: false },
          ],
        });

        if (existing) {
          existing.name = name;
          existing.shortName = shortName;
          existing.bin = bin;
          if (logoUrl) existing.logoUrl = logoUrl;
          existing.transferSupported = transferSupported;
          existing.lookupSupported = lookupSupported;
          existing.syncedAt = now;
          await this.repo.save(existing);
          updatedCount++;
        } else {
          const newEntity = this.repo.create({
            code,
            shortName,
            name,
            bin,
            logoUrl,
            aliases: [shortName, code],
            isActive: true,
            transferSupported,
            lookupSupported,
            syncedAt: now,
            extraData: {},
          });
          await this.repo.save(newEntity);
          insertedCount++;
        }
      }

      this.logger.log(
        `Đã đồng bộ VietQR: tổng ${body.data.length}, thêm mới ${insertedCount}, cập nhật ${updatedCount}`,
      );

      return {
        totalFetched: body.data.length,
        insertedCount,
        updatedCount,
        syncedAt: now,
      };
    } finally {
      clearTimeout(timeout);
    }
  }
}
