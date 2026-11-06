import {
  parseFilterRecord,
  TableColumnMap,
  TableFilterPayload,
} from '@/common/utils/table-query';

const CREATED_BY_EMAIL_SQL =
  '(SELECT cu.email FROM core_users cu WHERE cu.id = h.createdBy)';
/** Người duyệt hiển thị: người đã duyệt, chưa duyệt thì người được giao. */
const APPROVER_EMAIL_SQL =
  '(SELECT cu.email FROM core_users cu WHERE cu.id = COALESCE(h.approvedBy, h.approverId))';

export const TABLE_COLUMNS: TableColumnMap = {
  createdAt: { sql: 'h.createdAt', type: 'date' },
  created_at: { sql: 'h.createdAt', type: 'date' },
  requestNo: { sql: 'h.requestNo', type: 'text' },
  request_no: { sql: 'h.requestNo', type: 'text' },
  requestDate: { sql: 'h.requestDate', type: 'date' },
  request_date: { sql: 'h.requestDate', type: 'date' },
  neededDate: { sql: 'h.neededDate', type: 'date' },
  needed_date: { sql: 'h.neededDate', type: 'date' },
  title: { sql: 'h.title', type: 'text' },
  branchName: { sql: 'h.branchName', type: 'text' },
  branch_name: { sql: 'h.branchName', type: 'text' },
  branchId: { sql: 'CAST(h.branchId AS TEXT)', type: 'text' },
  branch_id: { sql: 'CAST(h.branchId AS TEXT)', type: 'text' },
  status: { sql: 'h.status', type: 'status' },
  orderingStatus: { sql: 'h.orderingStatus', type: 'status' },
  ordering_status: { sql: 'h.orderingStatus', type: 'status' },
  // Lọc, sắp xếp và danh sách option theo email (không theo UUID).
  createdBy: { sql: CREATED_BY_EMAIL_SQL, type: 'text' },
  created_by: { sql: CREATED_BY_EMAIL_SQL, type: 'text' },
  approver: { sql: APPROVER_EMAIL_SQL, type: 'text' },
};

export const SEARCH_COLUMNS = ['h.requestNo', 'h.title', 'h.branchName'];

/** Chuyển raw filter JSON thành envelope TableFilterPayload cho options query. */
export function toFilterPayload(raw: unknown): TableFilterPayload {
  const parsed = parseFilterRecord<
    TableFilterPayload & Record<string, unknown>
  >(raw);
  if (!parsed) return {};
  const hasEnvelope = [
    'columnFilters',
    'columnSearch',
    'columnOperators',
    'dateRanges',
  ].some((key) => key in parsed);
  return hasEnvelope
    ? parsed
    : { columnFilters: parsed as Record<string, string[]> };
}
