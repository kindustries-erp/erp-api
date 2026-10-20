/**
 * vinfast-sync-run.state.ts
 *
 * Trạng thái một lượt đồng bộ phụ tùng VinFast: cho phép hỏi lại tiến trình khi SSE không nhận được sự kiện,
 * và chặn chạy trùng (một lượt tại một thời điểm trong tiến trình API).
 */

export interface VinfastSyncRunSnapshot {
  running: boolean;
  startedAt: string | null;
  finishedAt: string | null;
  phase: string | null;
  current: number;
  total: number;
  message: string | null;
  lastError: string | null;
}

export interface VinfastSyncProgressEvent {
  processId?: string;
  type?: string;
  current?: number;
  total?: number;
  message?: string;
  completed?: boolean;
}

export class VinfastSyncRunState {
  private state: VinfastSyncRunSnapshot = {
    running: false,
    startedAt: null,
    finishedAt: null,
    phase: null,
    current: 0,
    total: 0,
    message: null,
    lastError: null,
  };

  constructor(private readonly now: () => Date = () => new Date()) {}

  /** Bắt đầu một lượt. Trả false nếu đang có lượt chạy. */
  start(): boolean {
    if (this.state.running) return false;
    this.state = {
      running: true,
      startedAt: this.now().toISOString(),
      finishedAt: null,
      phase: null,
      current: 0,
      total: 0,
      message: null,
      lastError: null,
    };
    return true;
  }

  applyProgress(event: VinfastSyncProgressEvent): void {
    if (!this.state.running) return;
    this.state = {
      ...this.state,
      phase: event.type ?? this.state.phase,
      current: event.current ?? this.state.current,
      total: event.total ?? this.state.total,
      message: event.message ?? this.state.message,
    };
  }

  finish(error?: string): void {
    this.state = {
      ...this.state,
      running: false,
      finishedAt: this.now().toISOString(),
      lastError: error ?? null,
    };
  }

  /** Bản sao độc lập để trả về API. */
  snapshot(): VinfastSyncRunSnapshot {
    return { ...this.state };
  }
}
