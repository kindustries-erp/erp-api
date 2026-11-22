import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CoreUserTablePreference } from '../entities/core-user-table-preference.entity';
import type {
  TablePreferenceColumnsPatch,
  TablePreferenceFilterQueryPatch,
  TablePreferencePatch,
  TablePreferenceViewsPatch,
} from '@/v2/core/table-preferences-core';

@Injectable()
export class TablePreferenceCommandService {
  constructor(
    @InjectRepository(CoreUserTablePreference)
    private readonly repo: Repository<CoreUserTablePreference>,
  ) {}

  /**
   * Upsert theo (userId, tableId) bằng INSERT ... ON CONFLICT DO UPDATE.
   * Chỉ ghi các trường được gửi; an toàn khi hai request đồng thời (AC-3).
   */
  async upsert(
    userId: string,
    tableId: string,
    patch: TablePreferencePatch,
  ): Promise<CoreUserTablePreference> {
    // Ghi đè is_deleted=false để dòng đã xóa mềm được dùng lại thay vì bị giữ nguyên trạng thái xóa
    const overwrite: string[] = ['updated_at', 'is_deleted'];
    const values: Pick<
      CoreUserTablePreference,
      'userId' | 'tableId' | 'columns' | 'views' | 'isDeleted'
    > = {
      userId,
      tableId,
      columns: {},
      views: {},
      isDeleted: false,
    };

    if (patch.columns !== undefined) {
      values.columns = pickColumns(patch.columns);
      overwrite.push('columns');
    }
    if (patch.views !== undefined) {
      values.views = pickViews(patch.views);
      overwrite.push('views');
    }

    await this.repo
      .createQueryBuilder()
      .insert()
      .into(CoreUserTablePreference)
      .values(values)
      .orUpdate(overwrite, ['user_id', 'table_id'])
      .execute();

    return this.repo.findOneOrFail({ where: { userId, tableId } });
  }
}

/** Chỉ giữ khóa đã khai báo, tránh lưu rác vào jsonb */
function pickColumns(input: TablePreferenceColumnsPatch) {
  const out: Record<string, unknown> = {};
  if (input.visibility !== undefined) out.visibility = { ...input.visibility };
  if (input.order !== undefined) out.order = [...input.order];
  if (input.sizing !== undefined) out.sizing = { ...input.sizing };
  return out;
}

function pickViews(input: TablePreferenceViewsPatch) {
  const out: Record<string, unknown> = {};
  if (input.customViews !== undefined) {
    out.customViews = input.customViews.map((view) => ({
      key: view.key,
      label: view.label,
      baseKey: view.baseKey,
      visibility: { ...view.visibility },
      order: [...view.order],
      // Chỉ ghi khi có, để view cũ không sinh thêm khóa null trong jsonb
      ...(view.filterKey !== undefined && { filterKey: view.filterKey }),
    }));
  }
  if (input.customFilters !== undefined) {
    out.customFilters = input.customFilters.map((filter) => ({
      key: filter.key,
      label: filter.label,
      ...(filter.groupKey !== undefined && { groupKey: filter.groupKey }),
      query: pickFilterQuery(filter.query),
    }));
  }
  if (input.activeKey !== undefined) out.activeKey = input.activeKey;
  if (input.filterKey !== undefined) out.filterKey = input.filterKey;
  return out;
}

/** Chỉ giữ 6 khóa của query, bỏ khóa lạ và giá trị undefined */
function pickFilterQuery(query: TablePreferenceFilterQueryPatch) {
  const out: TablePreferenceFilterQueryPatch = {};
  if (query.sort !== undefined) out.sort = query.sort;
  if (query.q !== undefined) out.q = query.q;
  if (query.cf !== undefined) out.cf = query.cf;
  if (query.cs !== undefined) out.cs = query.cs;
  if (query.co !== undefined) out.co = query.co;
  if (query.dr !== undefined) out.dr = query.dr;
  return out;
}
