import { Injectable } from '@nestjs/common';
import { TablePreferencesCoreService } from '@/v2/core/table-preferences-core';
import { ListTablePreferencesDto } from './dto/list-table-preferences.dto';
import { UpdateTablePreferenceDto } from './dto/update-table-preference.dto';
import {
  TablePreferenceListResponseDto,
  TablePreferenceResponseDto,
} from './dto/table-preference-response.dto';
import { toTablePreferenceResponse } from './helpers/table-preference.mapper';

/** Facade HTTP: gọi lõi và map sang response DTO */
@Injectable()
export class TablePreferencesService {
  constructor(private readonly core: TablePreferencesCoreService) {}

  async list(
    userId: string,
    dto: ListTablePreferencesDto,
  ): Promise<TablePreferenceListResponseDto> {
    const rows = await this.core.listForUser(userId, dto.tableIdPrefix);
    return { items: rows.map(toTablePreferenceResponse) };
  }

  async update(
    userId: string,
    tableId: string,
    dto: UpdateTablePreferenceDto,
  ): Promise<TablePreferenceResponseDto> {
    const row = await this.core.upsertForUser(userId, tableId, dto);
    return toTablePreferenceResponse(row);
  }
}
