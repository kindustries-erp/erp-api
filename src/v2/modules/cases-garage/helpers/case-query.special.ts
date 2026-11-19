import type { ObjectLiteral, SelectQueryBuilder } from 'typeorm';
import { CaseStatus } from '../entities/case-garage.enums';

type Qb = SelectQueryBuilder<ObjectLiteral>;
type Filters = Record<string, string[]> | undefined;

const TAB_STATUSES: Record<string, CaseStatus[]> = {
  quotation: [CaseStatus.QUOTED],
  in_progress: [CaseStatus.INTAKE, CaseStatus.IN_PROGRESS],
  completed: [CaseStatus.COMPLETED],
};

const LINKED =
  'EXISTS (SELECT 1 FROM kgara_case_linked_invoice l WHERE l."caseDbId" = "c"."id")';

/** Bộ lọc đặc thù của danh sách vụ việc không phải cột đơn (tab trạng thái, tiến độ thu, loại trừ, HĐ liên kết). */
export function applyCaseSpecialFilters(qb: Qb, filters: Filters): void {
  if (!filters) return;
  const tab = filters.statusTab;
  if (tab?.length) {
    const statuses = tab.flatMap((k) => TAB_STATUSES[k] ?? []);
    if (statuses.length)
      qb.andWhere('"c"."status" IN (:...tabStatuses)', {
        tabStatuses: statuses,
      });
  }
  const progress = filters.collectionProgress;
  if (progress?.length) {
    const paid = 'COALESCE("c"."paid_amount", 0)';
    const out = 'COALESCE("c"."outstanding_amount", 0)';
    const cond: string[] = [];
    if (progress.includes('PAID')) cond.push(`(${out} <= 0 AND ${paid} > 0)`);
    if (progress.includes('PARTIAL')) cond.push(`(${paid} > 0 AND ${out} > 0)`);
    if (progress.includes('UNPAID')) cond.push(`(${paid} <= 0 AND ${out} > 0)`);
    if (cond.length) qb.andWhere(`(${cond.join(' OR ')})`);
  }
  const rules = filters.exclusionRules;
  if (rules?.length) {
    const cond: string[] = [];
    if (rules.includes('EXCLUDE_REPORTS'))
      cond.push('"c"."exclude_from_reports" IS TRUE');
    if (rules.includes('EXCLUDE_DEBT'))
      cond.push('"c"."exclude_from_debt" IS TRUE');
    if (rules.includes('NORMAL'))
      cond.push(
        '("c"."exclude_from_reports" IS NOT TRUE AND "c"."exclude_from_debt" IS NOT TRUE)',
      );
    if (cond.length) qb.andWhere(`(${cond.join(' OR ')})`);
  }
  const linked = filters.hasLinkedInvoice;
  if (linked?.length) {
    const cond: string[] = [];
    if (linked.includes('YES')) cond.push(LINKED);
    if (linked.includes('NO')) cond.push(`NOT ${LINKED}`);
    if (cond.length) qb.andWhere(`(${cond.join(' OR ')})`);
  }
}
