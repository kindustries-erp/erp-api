import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { buildPagination } from '@/common/utils/paginated-result';
import { EmployeeManagement } from '@/v2/modules/employees-management/entities/employee-management.entity';
import type {
  CaseProgressListResponse,
  QueryCaseProgressDto,
} from '../dto/case-progress.dto';
import { CaseGarage } from '../entities/case-garage.entity';
import { CaseStatus } from '../entities/case-garage.enums';
import { CaseLineGarage } from '../entities/case-line-garage.entity';
import { isLineDeleted } from '../helpers/case-override.helper';
import { toCaseProgressItem } from '../helpers/case-progress.mapper';

const DEFAULT_PAGE_SIZE = 50;
const SUMMARY_LINES = 3;

/** Bảng theo dõi tiến độ xe (đọc). Thời gian đã làm và quá hạn tính lúc đọc, không lưu cột. */
@Injectable()
export class CaseProgressQueryService {
  constructor(private readonly dataSource: DataSource) {}

  async findPage(
    branch: string,
    q: QueryCaseProgressDto,
    now = new Date(),
  ): Promise<CaseProgressListResponse> {
    const page = q.page ?? 1;
    const pageSize = q.pageSize ?? DEFAULT_PAGE_SIZE;
    const qb = this.dataSource
      .getRepository(CaseGarage)
      .createQueryBuilder('c')
      .where('c.is_deleted = false')
      .andWhere('c.external_deleted_at IS NULL')
      .andWhere('c.branch_external_id = :branch', { branch });
    const status = q.status ?? CaseStatus.IN_PROGRESS;
    if (status !== 'ALL') qb.andWhere('c.status = :status', { status });
    if (q.assigneeId) qb.andWhere('c.assignee_id = :a', { a: q.assigneeId });
    if (q.stage) qb.andWhere('c.progress_stage = :stage', { stage: q.stage });
    if (q.overdue) {
      qb.andWhere('c.expected_completion_at < :now', { now }).andWhere(
        'c.status NOT IN (:...done)',
        {
          done: [CaseStatus.COMPLETED, CaseStatus.CANCELLED],
        },
      );
    }
    if (q.search?.trim()) {
      qb.andWhere(
        '(c.license_plate ILIKE :s OR c.case_code ILIKE :s OR c.customer_name ILIKE :s)',
        { s: `%${q.search.trim()}%` },
      );
    }
    const [rows, total] = await qb
      .orderBy('c.expected_completion_at', 'ASC', 'NULLS LAST')
      .addOrderBy('c.received_at', 'DESC', 'NULLS LAST')
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();

    const names = await this.employeeNames(rows);
    const summaries = await this.lineSummaries(rows);
    return {
      items: rows.map((c) =>
        toCaseProgressItem(
          c,
          c.assigneeId ? (names.get(c.assigneeId) ?? null) : null,
          summaries.get(c.id) ?? null,
          now,
        ),
      ),
      pagination: buildPagination(page, pageSize, total),
    };
  }

  private async employeeNames(rows: CaseGarage[]) {
    const ids = [...new Set(rows.map((r) => r.assigneeId).filter(Boolean))];
    if (!ids.length) return new Map<string, string>();
    const emps = await this.dataSource
      .getRepository(EmployeeManagement)
      .createQueryBuilder('e')
      .where('e.id IN (:...ids)', { ids })
      .getMany();
    return new Map(emps.map((e) => [e.id, e.fullName]));
  }

  /** Tóm tắt nội dung sửa chữa từ các dòng hạng mục, chỉ cho vụ việc chưa có `requestDescription`. */
  private async lineSummaries(rows: CaseGarage[]) {
    const ids = rows
      .filter((r) => !r.requestDescription?.trim())
      .map((r) => r.id);
    const out = new Map<string, string>();
    if (!ids.length) return out;
    const lines = await this.dataSource
      .getRepository(CaseLineGarage)
      .createQueryBuilder('l')
      .where('l.case_id IN (:...ids)', { ids })
      .andWhere('l.external_deleted_at IS NULL')
      .orderBy('l.line_number', 'ASC')
      .getMany();
    const grouped = new Map<string, string[]>();
    for (const l of lines) {
      const text = (l.description || l.productName || '').trim();
      if (!text || isLineDeleted(l.overrides)) continue;
      const arr = grouped.get(l.caseId) ?? [];
      if (arr.length < SUMMARY_LINES) arr.push(text);
      grouped.set(l.caseId, arr);
    }
    for (const [id, arr] of grouped) out.set(id, arr.join('; '));
    return out;
  }
}
