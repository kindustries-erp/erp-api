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
}

export interface TablePreferenceViewsPatch {
  customViews?: TablePreferenceCustomViewPatch[];
  activeKey?: string;
  filterKey?: string;
}

/** Ghi đè từng phần: trường `undefined` giữ nguyên trên server */
export interface TablePreferencePatch {
  columns?: TablePreferenceColumnsPatch;
  views?: TablePreferenceViewsPatch;
}
