import type { ApprovalActorService } from '../approval-actor.service';
import type { ApprovalEmailLookup } from './approval-summary.mapper';

/** Các cột user id của một chứng từ duyệt. Thiếu cột nào thì bỏ qua. */
export interface ApprovalPeopleSource {
  createdBy?: string | null;
  approverId?: string | null;
  submittedBy?: string | null;
  approvedBy?: string | null;
  rejectedBy?: string | null;
  cancelledBy?: string | null;
  closedBy?: string | null;
  issuedBy?: string | null;
}

/**
 * Gom mọi user id trong cả trang rồi tra email một lần (một truy vấn cho lô).
 * Trả hàm tra cứu dùng chung cho mọi dòng của trang.
 */
export async function resolveApprovalEmails(
  actors: Pick<ApprovalActorService, 'resolve'>,
  headers: ReadonlyArray<ApprovalPeopleSource>,
): Promise<ApprovalEmailLookup> {
  const ids = headers.flatMap((h) => [
    h.createdBy,
    h.approverId,
    h.submittedBy,
    h.approvedBy,
    h.rejectedBy,
    h.cancelledBy,
    h.closedBy,
    h.issuedBy,
  ]);
  const infos = await actors.resolve(ids);
  return (userId) => (userId ? (infos.get(userId)?.email ?? null) : null);
}
