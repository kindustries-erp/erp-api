import type { ColumnOptions } from 'typeorm';
import type { OverrideMap } from '../helpers/link-override.helper';

/**
 * Hai cột jsonb dùng chung cho mọi entity có field liên kết nguồn (FK hoặc sync ngoài).
 * Entity cụ thể đã kế thừa một base khác nên không kế thừa được thêm: khai báo cột bằng
 * `@Column(LINK_SNAPSHOT_COLUMN)` và `@Column(LINK_OVERRIDES_COLUMN)`, kiểu theo `LinkOverrideColumns`.
 */
export interface LinkOverrideColumns {
  /** Giá trị mới nhất của nguồn, khóa camelCase. */
  sourceSnapshot: Record<string, unknown>;
  /** Tập field đã sửa cục bộ (khóa camelCase → true). */
  overrides: OverrideMap;
}

export const LINK_SNAPSHOT_COLUMN: ColumnOptions = {
  type: 'jsonb',
  name: 'source_snapshot',
  default: () => "'{}'",
};

export const LINK_OVERRIDES_COLUMN: ColumnOptions = {
  type: 'jsonb',
  name: 'overrides',
  default: () => "'{}'",
};
