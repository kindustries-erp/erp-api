import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CoreUserTablePreference } from '@/users/entities/core-user-table-preference.entity';
import { UpdateTablePreferenceDto } from '../dto/update-table-preference.dto';

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
    dto: UpdateTablePreferenceDto,
  ): Promise<CoreUserTablePreference> {
    const overwrite: string[] = ['updated_at'];
    const values: Partial<CoreUserTablePreference> = {
      userId,
      tableId,
      columns: {},
      views: {},
    };

    if (dto.columns !== undefined) {
      values.columns = pickColumns(dto.columns);
      overwrite.push('columns');
    }
    if (dto.views !== undefined) {
      values.views = pickViews(dto.views);
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
function pickColumns(input: UpdateTablePreferenceDto['columns']) {
  const out: Record<string, unknown> = {};
  if (!input) return out;
  if (input.visibility !== undefined) out.visibility = { ...input.visibility };
  if (input.order !== undefined) out.order = [...input.order];
  if (input.sizing !== undefined) out.sizing = { ...input.sizing };
  return out;
}

function pickViews(input: UpdateTablePreferenceDto['views']) {
  const out: Record<string, unknown> = {};
  if (!input) return out;
  if (input.customViews !== undefined) {
    out.customViews = input.customViews.map((view) => ({
      key: view.key,
      label: view.label,
      baseKey: view.baseKey,
      visibility: { ...view.visibility },
      order: [...view.order],
    }));
  }
  if (input.activeKey !== undefined) out.activeKey = input.activeKey;
  if (input.filterKey !== undefined) out.filterKey = input.filterKey;
  return out;
}
