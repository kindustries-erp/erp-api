import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import type {
  CaseProgressLogItem,
  CaseWorkshopBoardResponse,
  QueryWorkshopBoardDto,
} from '../dto/case-progress-log.dto';
import { CaseProgressLogGarage } from '../entities/case-progress-log-garage.entity';
import { CaseProgressLogKind } from '../entities/case-progress.enums';
import { toProgressLogItem } from '../helpers/case-progress-log.mapper';
import { toWorkshopBoardItem } from '../helpers/case-workshop.mapper';
import { CaseCommandService } from './case-command.service';
import { CaseProgressQueryService } from './case-progress-query.service';

const DEFAULT_PAGE_SIZE = 200;
const DEFAULT_FINISHED_DAYS = 7;
const DAY_MS = 86_400_000;

/**
 * Đọc cho trang tiến độ xưởng: board xe đã được đưa vào bảng, mọi status v2 (xe đã xong chỉ trong `finishedDays` ngày) kèm thời gian
 * công đoạn đang mở, và timeline nhật ký của một xe. Thời gian tính lúc đọc, không lưu cột.
 */
@Injectable()
export class CaseWorkshopQueryService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly progress: CaseProgressQueryService,
    private readonly cases: CaseCommandService,
  ) {}

  async board(
    branch: string,
    q: QueryWorkshopBoardDto,
    now = new Date(),
  ): Promise<CaseWorkshopBoardResponse> {
    const days = q.finishedDays ?? DEFAULT_FINISHED_DAYS;
    const page = await this.progress.findPage(
      branch,
      {
        status: 'ALL',
        page: q.page ?? 1,
        pageSize: q.pageSize ?? DEFAULT_PAGE_SIZE,
        search: q.search,
        assigneeId: q.assigneeId,
      },
      now,
      {
        finishedSince: new Date(now.getTime() - days * DAY_MS),
        trackedOnly: true,
      },
    );
    const ids = page.items.map((i) => i.id);
    const [openStages, lastNotes] = await Promise.all([
      this.openStages(ids),
      this.lastNotes(ids),
    ]);
    return {
      items: page.items.map((item) =>
        toWorkshopBoardItem(
          item,
          openStages.get(item.id),
          lastNotes.get(item.id),
          now,
        ),
      ),
      pagination: page.pagination,
    };
  }

  /** Timeline mới nhất trước; kiểm xe thuộc chi nhánh. */
  async timeline(
    branch: string,
    caseId: string,
    now = new Date(),
  ): Promise<CaseProgressLogItem[]> {
    await this.cases.findOwned(this.dataSource.manager, branch, caseId);
    const logs = await this.dataSource
      .getRepository(CaseProgressLogGarage)
      .find({
        where: { caseId, branchExternalId: branch, isDeleted: false },
        order: { startedAt: 'DESC', createdAt: 'DESC' },
      });
    return logs.map((l) => toProgressLogItem(l, now));
  }

  private async openStages(ids: string[]) {
    const out = new Map<string, CaseProgressLogGarage>();
    if (!ids.length) return out;
    const rows = await this.dataSource
      .getRepository(CaseProgressLogGarage)
      .createQueryBuilder('l')
      .where('l.case_id IN (:...ids)', { ids })
      .andWhere('l.kind = :kind', { kind: CaseProgressLogKind.STAGE })
      .andWhere('l.ended_at IS NULL')
      .andWhere('l.is_deleted = false')
      .getMany();
    for (const r of rows) out.set(r.caseId, r);
    return out;
  }

  /** Ghi chú mới nhất của mỗi xe (DISTINCT ON theo case_id). */
  private async lastNotes(ids: string[]) {
    const out = new Map<string, CaseProgressLogGarage>();
    if (!ids.length) return out;
    const rows = await this.dataSource
      .getRepository(CaseProgressLogGarage)
      .createQueryBuilder('l')
      .distinctOn(['l.case_id'])
      .where('l.case_id IN (:...ids)', { ids })
      .andWhere('l.kind = :kind', { kind: CaseProgressLogKind.NOTE })
      .andWhere('l.is_deleted = false')
      .orderBy('l.case_id')
      .addOrderBy('l.started_at', 'DESC')
      .getMany();
    for (const r of rows) out.set(r.caseId, r);
    return out;
  }
}
