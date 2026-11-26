import type { EntityManager } from 'typeorm';
import type { DebtDirection } from './debt-account.contract';

/** Nợ phát sinh từ một chứng từ nguồn (vụ việc, phiếu nhập kho...). Khóa: nguồn + chiều + đối tượng nợ. */
export interface UpsertDebtOriginCommand {
  branchExternalId: string;
  /** Chi nhánh ERP; `undefined` thì giữ nguyên giá trị đang có của dòng nợ. */
  branchId?: string | null;
  sourceType: string;
  sourceId: string;
  direction: DebtDirection;
  partyType: string;
  partyCode: string;
  partyName?: string | null;
  caseId?: string | null;
  partnerId?: string | null;
  licensePlate?: string | null;
  /** Số nợ gốc mới (>= 0). */
  originalAmount: number;
  dueBaseDate?: string | null;
  excluded?: boolean;
  /** SYNC (suy ra từ nguồn), MANUAL hoặc LEGACY. */
  origin?: string;
}

export interface VoidDebtOriginCommand {
  sourceType: string;
  sourceId: string;
  direction: DebtDirection;
  partyType: string;
}

/**
 * Cổng phát sinh nợ: mọi luồng tạo hoặc đổi nợ gốc gọi cổng này trong transaction của chính nó.
 * KHÔNG đổi `settled_amount` (đó là việc của `DebtSettlementPort`); chỉ tính lại `balance_amount` từ số đã phân bổ.
 */
export interface DebtOriginPort {
  upsertOrigin(
    manager: EntityManager,
    command: UpsertDebtOriginCommand,
  ): Promise<{ debtId: string; created: boolean }>;

  /** Đánh dấu VOID khi nguồn bị hủy; trả false nếu không có dòng nợ. */
  voidOrigin(
    manager: EntityManager,
    command: VoidDebtOriginCommand,
  ): Promise<boolean>;
}
