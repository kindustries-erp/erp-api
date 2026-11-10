/** Hình dạng cấu hình cột gửi vào lõi (trung tính, không phụ thuộc DTO của module) */
export interface TablePreferenceColumnsPatch {
  visibility?: Record<string, boolean>;
  order?: string[];
  sizing?: Record<string, number>;
}

export interface TablePreferenceCustomViewPatch {
  key: string;
  label: string;
  baseKey: string;
  visibility: Record<string, boolean>;
  order: string[];
  /** Bộ lọc có sẵn đi kèm view; undefined = view cũ, không áp bộ lọc */
  filterKey?: string;
}

/** Điều kiện bảng đã lưu (cùng định dạng query string của URL V2) */
export interface TablePreferenceFilterQueryPatch {
  sort?: string;
  q?: string;
  cf?: string;
  cs?: string;
  co?: string;
  dr?: string;
}

export interface TablePreferenceCustomFilterPatch {
  key: string;
  label: string;
  /** Bộ lọc có sẵn gốc lúc lưu; undefined = không gắn nhóm */
  groupKey?: string;
  query: TablePreferenceFilterQueryPatch;
}

export interface TablePreferenceViewsPatch {
  customViews?: TablePreferenceCustomViewPatch[];
  /** Bộ lọc tùy chỉnh; undefined = giữ nguyên trên server */
  customFilters?: TablePreferenceCustomFilterPatch[];
  activeKey?: string;
  filterKey?: string;
}

/** Ghi đè từng phần: trường `undefined` giữ nguyên trên server */
export interface TablePreferencePatch {
  columns?: TablePreferenceColumnsPatch;
  views?: TablePreferenceViewsPatch;
}
