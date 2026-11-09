import { Injectable } from '@nestjs/common';
import { CoreUserTablePreference } from '../entities/core-user-table-preference.entity';
import type { TablePreferencePatch } from '../types/table-preference.types';
import { TablePreferenceCommandService } from './table-preference-command.service';
import { TablePreferenceQueryService } from './table-preference-query.service';

/** Facade nghiệp vụ của lõi: module HTTP và các caller khác đi qua đây */
@Injectable()
export class TablePreferencesCoreService {
  constructor(
    private readonly query: TablePreferenceQueryService,
    private readonly command: TablePreferenceCommandService,
  ) {}

  listForUser(
    userId: string,
    tableIdPrefix?: string,
  ): Promise<CoreUserTablePreference[]> {
    return this.query.listForUser(userId, tableIdPrefix);
  }

  upsertForUser(
    userId: string,
    tableId: string,
    patch: TablePreferencePatch,
  ): Promise<CoreUserTablePreference> {
    return this.command.upsert(userId, tableId, patch);
  }
}
