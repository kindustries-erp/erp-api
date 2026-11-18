export type ExportJobStatus = 'RUNNING' | 'COMPLETED' | 'FAILED';

/** Sự kiện tiến độ phát qua SSE. Bộ field là hợp đồng với Web, không đổi. */
export type ExportProgressEvent = {
  processId: string;
  userId?: string;
  jobId?: string;
  current: number;
  total: number;
  isRunning: boolean;
  completed: boolean;
  ready: boolean;
  failed: boolean;
  message?: string;
  fileName?: string;
};

export type ExportHistoryItem = {
  jobId: string;
  fileName: string;
  status: ExportJobStatus;
  current: number;
  total: number;
  message: string;
  createdAt: string;
  finishedAt?: string;
  expiresAt?: string;
  dateFrom?: string;
  dateTo?: string;
  canDownload: boolean;
};

export type ExportHistoryResult = {
  items: ExportHistoryItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export type ExportStartResult = {
  jobId: string;
  message: string;
  reused?: boolean;
};

export type ExportProgressReporter = (
  current: number,
  total: number,
  message: string,
) => void;

export type ExportJobProducer = (
  onProgress: ExportProgressReporter,
) => Promise<Buffer | Uint8Array | ArrayBuffer>;

export type ExportJobStartInput = {
  userId: string;
  /** Chuỗi ổn định đại diện bộ lọc, dùng để tái sử dụng file đã tạo. */
  fingerprint: string;
  fileName: string;
  totalUnits: number;
  dateFrom?: string;
  dateTo?: string;
  /** Trường bổ sung của module (vd `partnerType`), được trả nguyên trong lịch sử. */
  extra?: Record<string, unknown>;
  producer: ExportJobProducer;
};

export type ExportJob = {
  id: string;
  userId: string;
  status: ExportJobStatus;
  current: number;
  total: number;
  message: string;
  createdAt: number;
  finishedAt?: number;
  fileName: string;
  fingerprint: string;
  dateFrom?: string;
  dateTo?: string;
  extra?: Record<string, unknown>;
  buffer?: Buffer;
  error?: string;
  expiresAt?: number;
};

export type ExportJobRunnerOptions = {
  /** Định danh tiến trình, đi kèm mọi sự kiện SSE (vd: `invoice-xlsx-export`). */
  processId: string;
  ttlMs?: number;
  /**
   * Chỉ tái sử dụng file đã tạo trong khoảng này (ms) kể từ lúc hoàn tất.
   * Mặc định: trong suốt TTL. Dữ liệu đổi nhanh (công nợ) nên đặt ngắn.
   */
  reuseWindowMs?: number;
  cleanupIntervalMs?: number;
};

export const EXPORT_JOB_DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;
