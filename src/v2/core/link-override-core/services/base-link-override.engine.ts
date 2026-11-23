import { NotFoundException } from '@nestjs/common';
import type { LinkSourcePort } from '../contracts/link-source.port';
import {
  type OverrideMap,
  hasOverride,
  markOverrides,
  revertFields,
  toSnapshotValue,
} from '../helpers/link-override.helper';

type Dict = Record<string, unknown>;

/** Trạng thái override hiện có của một bản ghi. */
export interface LinkOverrideState {
  sourceSnapshot: Dict;
  overrides: OverrideMap;
}

/** Kết quả engine: giá trị cột cần ghi (`values`) cùng snapshot/overrides mới. */
export interface LinkOverrideResult extends LinkOverrideState {
  values: Dict;
}

/**
 * Engine nền cho "liên kết FK + sửa cục bộ không đè nguồn". Hàm thuần theo trạng thái truyền vào,
 * không ghi DB, không ghi nguồn. Module con khai báo `trackedKeys` (field theo dõi, camelCase) và
 * truyền `LinkSourcePort` cụ thể; service của module tự lưu `values/sourceSnapshot/overrides`.
 * Snapshot do server lập từ nguồn; client chỉ gửi id FK và giá trị đã sửa.
 */
export abstract class BaseLinkOverrideEngine {
  protected abstract readonly trackedKeys: ReadonlySet<string>;
  /** Khóa lưu snapshot dạng ISO cần đổi về Date khi revert. */
  protected readonly dateKeys: ReadonlySet<string> = new Set();

  constructor(protected readonly source: LinkSourcePort) {}

  /** Chọn FK mới: lập snapshot từ nguồn, áp `edits` (nếu có) và đánh dấu field khác nguồn. */
  async capture(fkId: string, edits: Dict = {}): Promise<LinkOverrideResult> {
    const sourceSnapshot = await this.readSnapshot(fkId);
    const tracked = this.pickTracked(edits);
    const overrides = markOverrides(
      tracked,
      sourceSnapshot,
      {},
      this.trackedKeys,
    );
    return {
      sourceSnapshot,
      overrides,
      values: { ...this.fromSnapshot(sourceSnapshot), ...tracked },
    };
  }

  /** Sửa cục bộ: chỉ cập nhật `overrides`; khóa không theo dõi bị bỏ qua. */
  applyEdit(fields: Dict, state: LinkOverrideState): OverrideMap {
    return markOverrides(
      fields,
      state.sourceSnapshot,
      state.overrides,
      this.trackedKeys,
    );
  }

  /** Về giá trị nguồn cho `keys` đang bị override (lấy từ snapshot đã lưu, không gọi nguồn). */
  revert(
    keys: readonly string[],
    state: LinkOverrideState,
  ): LinkOverrideResult {
    const tracked = keys.filter((k) => this.trackedKeys.has(k));
    const r = revertFields(
      tracked,
      state.sourceSnapshot,
      state.overrides,
      this.dateKeys,
    );
    return {
      values: r.values,
      overrides: r.overrides,
      sourceSnapshot: state.sourceSnapshot,
    };
  }

  /**
   * Cập nhật từ nguồn: đọc lại nguồn, làm mới snapshot. Field chưa override nhận giá trị mới;
   * field đang override giữ nguyên trừ khi nằm trong `force` (khi đó về giá trị nguồn).
   */
  async refresh(
    fkId: string,
    state: LinkOverrideState,
    force: readonly string[] = [],
  ): Promise<LinkOverrideResult> {
    const sourceSnapshot = await this.readSnapshot(fkId);
    const overrides: OverrideMap = { ...state.overrides };
    const values: Dict = {};
    for (const key of this.trackedKeys) {
      if (!(key in sourceSnapshot)) continue;
      if (hasOverride(overrides, key) && !force.includes(key)) continue;
      delete overrides[key];
      values[key] = this.fromSnapshot(sourceSnapshot)[key];
    }
    return { values, sourceSnapshot, overrides };
  }

  private async readSnapshot(fkId: string): Promise<Dict> {
    const raw = await this.source.findValues(fkId);
    if (!raw)
      throw new NotFoundException('Không tìm thấy bản ghi nguồn liên kết');
    const snapshot: Dict = {};
    for (const key of this.trackedKeys) {
      if (key in raw) snapshot[key] = toSnapshotValue(raw[key]);
    }
    return snapshot;
  }

  private pickTracked(fields: Dict): Dict {
    const out: Dict = {};
    for (const [k, v] of Object.entries(fields)) {
      if (v !== undefined && this.trackedKeys.has(k)) out[k] = v;
    }
    return out;
  }

  /** Giá trị cột từ snapshot (ISO → Date cho khóa ngày). */
  private fromSnapshot(snapshot: Dict): Dict {
    const out: Dict = {};
    for (const [k, v] of Object.entries(snapshot)) {
      out[k] = this.dateKeys.has(k) && typeof v === 'string' ? new Date(v) : v;
    }
    return out;
  }
}
