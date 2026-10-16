export type BankStatementExportProgressEvent = {
  processId: 'bank-statement-xlsx-export' | 'ping';
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

export type BankStatementExportHistoryItem = {
  jobId: string;
  fileName: string;
  status: 'RUNNING' | 'COMPLETED' | 'FAILED';
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

export type BankStatementExportHistoryResult = {
  items: BankStatementExportHistoryItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export type BankStatementExportJob = {
  id: string;
  userId: string;
  status: 'RUNNING' | 'COMPLETED' | 'FAILED';
  current: number;
  total: number;
  message: string;
  createdAt: number;
  finishedAt?: number;
  fileName: string;
  queryFingerprint: string;
  dateFrom?: string;
  dateTo?: string;
  buffer?: Buffer;
  error?: string;
  expiresAt?: number;
};
