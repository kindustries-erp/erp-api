import { Injectable, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { AbstractAuditWriterService, AuditLogRow } from '@/v2/core/audit-core';
import { AuditLog } from '../entities/audit-log.entity';
import { isAuditLogEnabled } from '../helpers/audit-enabled';

/** Bộ ghi nhật ký duy nhất của hệ thống (interceptor và mọi caller đều đi qua đây). */
@Injectable()
export class AuditWriterService extends AbstractAuditWriterService {
  constructor(
    @InjectRepository(AuditLog)
    private readonly repository: Repository<AuditLog>,
    @Optional() private readonly configService?: ConfigService,
  ) {
    super();
  }

  get isEnabled(): boolean {
    return isAuditLogEnabled(this.configService);
  }

  protected async insertBatch(rows: AuditLogRow[]): Promise<void> {
    await this.repository
      .createQueryBuilder()
      .insert()
      .into(AuditLog)
      .values(rows as QueryDeepPartialEntity<AuditLog>[])
      .execute();
  }
}
