import type { CoreUserTablePreference } from '@/v2/core/table-preferences-core';
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
