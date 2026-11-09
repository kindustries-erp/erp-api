import { Injectable } from '@nestjs/common';
import { TablePreferenceCommandService } from './services/table-preference-command.service';
import { TablePreferenceQueryService } from './services/table-preference-query.service';
import { ListTablePreferencesDto } from './dto/list-table-preferences.dto';
import { UpdateTablePreferenceDto } from './dto/update-table-preference.dto';
import {
  TablePreferenceListResponseDto,
  TablePreferenceResponseDto,
} from './dto/table-preference-response.dto';
import { toTablePreferenceResponse } from './helpers/table-preference.mapper';

/** Facade HTTP của module table-preferences v2 */
@Injectable()
export class TablePreferencesService {
  constructor(
    private readonly query: TablePreferenceQueryService,
    private readonly command: TablePreferenceCommandService,
  ) {}

  async list(
    userId: string,
    dto: ListTablePreferencesDto,
  ): Promise<TablePreferenceListResponseDto> {
    const rows = await this.query.listForUser(userId, dto.tableIdPrefix);
    return { items: rows.map(toTablePreferenceResponse) };
  }

  async update(
    userId: string,
    tableId: string,
    dto: UpdateTablePreferenceDto,
  ): Promise<TablePreferenceResponseDto> {
    const row = await this.command.upsert(userId, tableId, dto);
    return toTablePreferenceResponse(row);
  }
}
