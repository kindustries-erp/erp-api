import type { ApprovalActorService } from '@/v2/core/approval-core/approval-actor.service';
import type { PurchaseRequestPeople } from './procurement-request.mapper';

export interface PurchaseRequestPeopleSource {
  id: string;
  createdBy: string | null;
  approvedBy: string | null;
  approverId: string | null;
}

/** Người duyệt hiển thị: người đã duyệt; chưa duyệt thì người được giao. */
export function displayApproverId(
  h: Pick<PurchaseRequestPeopleSource, 'approvedBy' | 'approverId'>,
): string | null {
  return h.approvedBy ?? h.approverId ?? null;
}

/** Tra email người tạo và người duyệt cho cả trang, một truy vấn, key theo id đề nghị. */
export async function resolvePurchaseRequestPeople(
  actors: Pick<ApprovalActorService, 'resolve'>,
  headers: ReadonlyArray<PurchaseRequestPeopleSource>,
): Promise<Map<string, PurchaseRequestPeople>> {
  const infos = await actors.resolve(
    headers.flatMap((h) => [h.createdBy, displayApproverId(h)]),
  );
  const emailOf = (id: string | null): string | null =>
    id ? (infos.get(id)?.email ?? null) : null;

  const out = new Map<string, PurchaseRequestPeople>();
  for (const h of headers) {
    out.set(h.id, {
      createdByEmail: emailOf(h.createdBy),
      approverEmail: emailOf(displayApproverId(h)),
    });
  }
  return out;
}
