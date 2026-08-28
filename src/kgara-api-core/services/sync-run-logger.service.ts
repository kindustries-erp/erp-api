import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GwSyncRun, GwSyncStatus } from '../entities/kgara_sync_run.entity';
import { parseSafeDate } from '../utils/kgara-parser.util';

@Injectable()
export class SyncRunLoggerService {
  private readonly logger = new Logger(SyncRunLoggerService.name);

  constructor(
    @InjectRepository(GwSyncRun)
    private readonly syncRunRepo: Repository<GwSyncRun>,
  ) {}

  async createSyncRun(
    branchId: string | null,
    endpoint: string,
    queryParams: any,
    pageSize: number,
  ): Promise<GwSyncRun> {
    const run = new GwSyncRun();
    run.branchExternalId = branchId;
    run.endpoint = endpoint;
    run.queryParams = queryParams;
    run.pageSize = pageSize;
    run.requestStartedAt = new Date();
    return this.syncRunRepo.save(run);
  }

  async closeSyncRun(
    run: GwSyncRun,
    status: GwSyncStatus,
    rowCount: number,
    errorMsg?: string,
    responseStatus?: number,
    dataAsOf?: string,
  ): Promise<void> {
    run.requestEndedAt = new Date();
    run.status = status;
    run.rowCount = rowCount;
    if (errorMsg) run.errorMessage = errorMsg;
    if (responseStatus) run.responseStatus = responseStatus;
    if (dataAsOf) run.dataAsOf = parseSafeDate(dataAsOf);
    await this.syncRunRepo.save(run);
  }

  async getIncrementalWatermark(
    branchExternalId: string,
    endpoint: string,
  ): Promise<string | undefined> {
    const lastRun = await this.syncRunRepo.findOne({
      where: { branchExternalId, endpoint, status: GwSyncStatus.SUCCESS },
      order: { requestStartedAt: 'DESC' },
    });
    if (!lastRun || !lastRun.requestStartedAt) return undefined;

    const lastDate = parseSafeDate(lastRun.requestStartedAt);
    if (!lastDate) return undefined;

    // Substract 10 minutes overlap as recommended
    const watermark = new Date(lastDate.getTime() - 10 * 60 * 1000);
    return watermark.toISOString();
  }
}
