import { Repository } from 'typeorm';

import { KgaraBranch } from '../entities/kgara_branch.entity';

export interface SyncableBranchesResult {
  branches: KgaraBranch[];
  /** false: chưa có liên kết ERP nào khớp, đang quét tất cả chi nhánh như cũ. */
  linked: boolean;
}

interface LinkRow {
  external_id: string;
  account_key: string | null;
}

/** Khóa so khớp chi nhánh KGara với liên kết ERP: `external_id` + `account_key`. */
const linkKey = (externalId: string, accountKey: string | null | undefined) =>
  `${externalId}|${accountKey ?? ''}`;

/**
 * Chi nhánh KGara cần đồng bộ: chỉ các dòng đã liên kết chi nhánh ERP
 * (`branches_management_external_links`, source KGARA). Liên kết không ghi
 * `account_key` thì khớp mọi tài khoản của external id đó. Chưa có liên kết nào
 * khớp thì trả tất cả (giữ hành vi cũ) và báo `linked=false` để ghi cảnh báo.
 */
export async function findSyncableBranches(
  branchRepo: Repository<KgaraBranch>,
  accountKeys?: string[],
): Promise<SyncableBranchesResult> {
  const all = await branchRepo.find({ order: { name: 'ASC' } });
  const inScope = accountKeys
    ? all.filter((b) => accountKeys.includes(b.accountKey))
    : all;

  const links: LinkRow[] = await branchRepo.manager.query(
    `SELECT external_id, account_key
       FROM branches_management_external_links
      WHERE source = 'KGARA' AND COALESCE(is_deleted, false) = false`,
  );
  const exact = new Set(
    links.map((l) => linkKey(l.external_id, l.account_key)),
  );
  const anyAccount = new Set(
    links.filter((l) => !l.account_key).map((l) => l.external_id),
  );

  const linked = inScope.filter(
    (b) =>
      exact.has(linkKey(b.externalId, b.accountKey)) ||
      anyAccount.has(b.externalId),
  );
  return linked.length > 0
    ? { branches: linked, linked: true }
    : { branches: inScope, linked: false };
}
