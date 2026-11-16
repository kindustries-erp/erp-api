import type { EntityManager } from 'typeorm';

import type {
  DebtAllocation,
  DebtAllocationSource,
} from './debt-allocation.contract';
import type { DebtBalance } from './debt-account.contract';

export interface ApplyDebtAllocationCommand {
  debtId: string;
  sourceType: DebtAllocationSource;
  sourceId: string | null;
  /** Dương. */
  amount: number;
  idempotencyKey: string;
  actorId?: string | null;
}

export interface ReverseDebtAllocationCommand {
  allocationId: string;
  /** Khóa riêng của thao tác đảo, để gửi lại không đảo hai lần. */
  idempotencyKey: string;
  actorId?: string | null;
}

export interface DebtSettlementResult {
  allocation: DebtAllocation;
  balance: DebtBalance;
  /** True khi `idempotencyKey` đã được áp trước đó; không có thay đổi mới. */
  replayed: boolean;
}

/**
 * Cổng ghi thanh toán vào công nợ: điểm duy nhất được phép đổi số dư (orchestrator dùng cổng này).
 *
 * Mọi hàm nhận `manager` của transaction đang chạy (xem `AbstractDebtFlowService.runInTransaction`),
 * cổng không tự mở transaction. Bản cài đặt PHẢI:
 * 1. Khóa dòng công nợ bằng `setLock('pessimistic_write')` trước khi đọc số dư.
 * 2. Idempotent theo `idempotencyKey`.
 * 3. Tính số dư bằng `DebtBalanceEngine`, không tự viết công thức riêng.
 */
export interface DebtSettlementPort {
  apply(
    manager: EntityManager,
    command: ApplyDebtAllocationCommand,
  ): Promise<DebtSettlementResult>;

  reverse(
    manager: EntityManager,
    command: ReverseDebtAllocationCommand,
  ): Promise<DebtSettlementResult>;

  /** Tính lại số dư từ các phân bổ chưa đảo. Đường tính duy nhất, thay cho các đường tính rải rác. */
  recalculate(manager: EntityManager, debtId: string): Promise<DebtBalance>;
}
