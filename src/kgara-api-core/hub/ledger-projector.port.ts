import { Logger } from '@nestjs/common';
import type { ModuleRef } from '@nestjs/core';

/** Token của cổng chiếu dữ liệu V1 sang sổ nợ v2 (provider đặt ở `debts-flow-garage`, V1 tìm lười để tránh vòng module). */
export const GARAGE_LEDGER_PROJECTOR = 'GARAGE_LEDGER_PROJECTOR';

/** Cổng V1 gọi SAU khi ghi xong. Chiếu sang bảng v2 theo id, idempotent. */
export interface GarageLedgerProjectorPort {
  /** Phiếu thu chi V1 vừa tạo hoặc sửa. */
  projectVoucher(voucherId: string): Promise<void>;
  /** Phiếu V1 vừa bị xóa (V1 xóa cứng); `caseId` là vụ việc của phiếu trước khi xóa. */
  removeVoucher(voucherId: string, caseId?: string | null): Promise<void>;
  /** Cấn trừ (settlement) hoặc dữ liệu vụ việc đổi: dựng lại nợ gốc và phân bổ của vụ việc. */
  projectCase(caseId: string): Promise<void>;
}

/**
 * Gọi cổng chiếu nếu đã đăng ký; không có (spec, môi trường chưa nạp module) thì bỏ qua.
 * Lỗi chỉ ghi log để không làm hỏng thao tác V1; script đối soát sẽ bắt lệch.
 */
export async function notifyLedgerProjector(
  moduleRef: ModuleRef | undefined,
  logger: Logger,
  call: (projector: GarageLedgerProjectorPort) => Promise<void>,
): Promise<void> {
  if (!moduleRef) return;
  try {
    const projector = moduleRef.get<GarageLedgerProjectorPort>(
      GARAGE_LEDGER_PROJECTOR,
      { strict: false },
    );
    await call(projector);
  } catch (error: unknown) {
    logger.warn(
      `Không chiếu được sang sổ nợ v2: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
