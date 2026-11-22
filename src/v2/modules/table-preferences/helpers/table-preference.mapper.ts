import type { CoreUserTablePreference } from '../entities/core-user-table-preference.entity';
import { TablePreferenceResponseDto } from '../dto/table-preference-response.dto';

/** Entity -> response DTO. Không trả entity ra ngoài module. */
export function toTablePreferenceResponse(
  row: Pick<
    CoreUserTablePreference,
    'tableId' | 'columns' | 'views' | 'updatedAt'
  >,
): TablePreferenceResponseDto {
  return {
    tableId: row.tableId,
    columns: row.columns ?? {},
    views: row.views ?? {},
    updatedAt: new Date(row.updatedAt).toISOString(),
  };
}
