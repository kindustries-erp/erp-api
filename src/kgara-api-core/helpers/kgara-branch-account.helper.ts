import { KgaraAccountKey } from '../enums/kgara-account.enum';

/** Một hàng kgara_branches (khóa kép external_id + account_key) */
export interface BranchAccountRow {
  externalId: string;
  accountKey: string;
}

export type BranchAccountResolution =
  | { ok: true; accountKey: KgaraAccountKey }
  | { ok: false; reason: 'INVALID_ACCOUNT' | 'AMBIGUOUS' };

const ACCOUNT_VALUES = new Set<string>(Object.values(KgaraAccountKey));

/**
 * Chọn tài khoản Kgara cho một chi nhánh, không đoán khi thiếu thông tin.
 * - `explicitAccount` hợp lệ: dùng luôn.
 * - Chi nhánh chỉ có một hàng: dùng account của hàng đó.
 * - Không có hàng: MAIN (giữ hành vi cũ).
 * - Nhiều hàng mà không có `explicitAccount`: AMBIGUOUS, người gọi phải yêu cầu tham số `account`.
 * Pure function: không I/O.
 */
export function resolveBranchAccount(
  rows: BranchAccountRow[],
  explicitAccount?: string | null,
): BranchAccountResolution {
  if (explicitAccount) {
    const value = explicitAccount.toUpperCase();
    if (!ACCOUNT_VALUES.has(value)) {
      return { ok: false, reason: 'INVALID_ACCOUNT' };
    }
    return { ok: true, accountKey: value as KgaraAccountKey };
  }
  if (rows.length === 0) {
    return { ok: true, accountKey: KgaraAccountKey.MAIN };
  }
  if (rows.length > 1) {
    return { ok: false, reason: 'AMBIGUOUS' };
  }
  return { ok: true, accountKey: rows[0].accountKey as KgaraAccountKey };
}
