import { Logger } from '@nestjs/common';
import type { ModuleRef } from '@nestjs/core';

/** Token cổng chiếu vụ việc V1 → v2 (provider ở `cases-garage`; V1 tìm lười để tránh vòng module). */
export const GARAGE_CASE_PROJECTOR = 'GARAGE_CASE_PROJECTOR';

export interface GarageCaseProjectorPort {
  /** Chiếu `kgara_cases` + dòng `kgara_case_services` của vụ việc sang bảng v2, idempotent theo id. */
  projectCase(caseId: string): Promise<void>;
}

/**
 * Gọi cổng chiếu nếu đã đăng ký; không có thì bỏ qua. Lỗi chỉ ghi log để không làm hỏng
 * thao tác V1; script backfill đối soát sẽ bắt lệch.
 */
export async function notifyCaseProjector(
  moduleRef: ModuleRef | undefined,
  logger: Logger,
  caseId: string | undefined | null,
): Promise<void> {
  if (!moduleRef || !caseId) return;
  try {
    const projector = moduleRef.get<GarageCaseProjectorPort>(
      GARAGE_CASE_PROJECTOR,
      { strict: false },
    );
    await projector.projectCase(caseId);
  } catch (error: unknown) {
    logger.warn(
      `Không chiếu được vụ việc ${caseId} sang v2: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
