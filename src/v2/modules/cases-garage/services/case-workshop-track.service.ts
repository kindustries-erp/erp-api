import {
  ConflictException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import type { CreateCaseDto } from '../dto/case-write.dto';
import type {
  CaseWorkshopTrackResult,
  TrackNewWorkshopCaseDto,
  TrackWorkshopCaseDto,
} from '../dto/case-workshop-track.dto';
import { CaseGarage } from '../entities/case-garage.entity';
import { CaseStatus } from '../entities/case-garage.enums';
import { normalizePlate, PLATE_SQL } from '../helpers/case-workshop-plate';
import { CaseCommandService } from './case-command.service';

const FINISHED = [CaseStatus.COMPLETED, CaseStatus.CANCELLED];

export interface TrackActor {
  id: string;
  /** Có quyền `garage:update`: cần khi đưa xe vào bảng ở trạng thái khác hiện tại. */
  canChangeStatus: boolean;
}

/**
 * Đưa xe vào hoặc bỏ khỏi bảng tiến độ xưởng (`workshop_tracked_at`). Ba trường hợp:
 * 1. Xe có sẵn, giữ trạng thái: chỉ đánh dấu.
 * 2. Xe có sẵn, khác trạng thái: đổi qua `CaseCommandService.updateStatus` (xe KGara ghi đè ở v2,
 *    xe NATIVE theo bảng chuyển trạng thái), cùng transaction với việc đánh dấu.
 * 3. Xe chưa có: tạo vụ việc NATIVE (biển số, tiếp nhận lúc này) rồi đánh dấu; chặn khi biển số đã
 *    có vụ việc đang mở trong chi nhánh.
 */
@Injectable()
export class CaseWorkshopTrackService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly cases: CaseCommandService,
  ) {}

  track(
    branch: string,
    dto: TrackWorkshopCaseDto,
    actor: TrackActor,
  ): Promise<CaseWorkshopTrackResult> {
    return this.dataSource.transaction(async (m) => {
      let current = await this.cases.findOwned(m, branch, dto.caseId, true);
      const changed = Boolean(dto.status) && dto.status !== current.status;
      if (changed) {
        if (!actor.canChangeStatus) {
          throw new ForbiddenException(
            'Bạn không có quyền đổi trạng thái vụ việc khi đưa xe vào bảng.',
          );
        }
        current = await this.cases.updateStatus(
          branch,
          current.id,
          dto.status as CaseStatus,
          actor.id,
          m,
        );
      }
      return this.mark(m, current, actor.id, changed, false);
    });
  }

  trackNew(
    branch: string,
    dto: TrackNewWorkshopCaseDto,
    actorId: string,
  ): Promise<CaseWorkshopTrackResult> {
    const plate = dto.licensePlate.trim().toUpperCase();
    const key = normalizePlate(plate);
    return this.dataSource.transaction(async (m) => {
      // Khóa theo chi nhánh + biển số để hai người cùng tạo một xe không ra hai vụ việc.
      await m.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
        `workshop:${branch}:${key}`,
      ]);
      const open = await this.findOpenByPlate(m, branch, key);
      if (open) {
        throw new ConflictException(
          `Xe ${plate} đã có vụ việc ${open.caseCode} đang mở. Hãy chọn xe trong danh sách.`,
        );
      }
      let created = await this.cases.create(
        branch,
        {
          licensePlate: plate,
          customerName: dto.customerName?.trim() || undefined,
          requestDescription: dto.requestDescription?.trim() || undefined,
          receivedAt: new Date().toISOString(),
        } as CreateCaseDto,
        actorId,
        m,
      );
      const target = dto.status ?? CaseStatus.INTAKE;
      const changed = target !== created.status;
      if (changed) {
        created = await this.cases.updateStatus(
          branch,
          created.id,
          target,
          actorId,
          m,
        );
      }
      return this.mark(m, created, actorId, changed, true);
    });
  }

  /** Bỏ xe khỏi bảng: chỉ xóa dấu, giữ nguyên vụ việc và nhật ký. */
  async untrack(branch: string, caseId: string): Promise<void> {
    await this.dataSource.transaction(async (m) => {
      await this.cases.findOwned(m, branch, caseId, true);
      await m.update(CaseGarage, { id: caseId }, {
        workshopTrackedAt: null,
        workshopTrackedBy: null,
      } as never);
    });
  }

  private findOpenByPlate(m: EntityManager, branch: string, key: string) {
    return m
      .getRepository(CaseGarage)
      .createQueryBuilder('c')
      .where('c.is_deleted = false')
      .andWhere('c.external_deleted_at IS NULL')
      .andWhere('c.branch_external_id = :branch', { branch })
      .andWhere('c.status NOT IN (:...finished)', { finished: FINISHED })
      .andWhere(`${PLATE_SQL} = :key`, { key })
      .getOne();
  }

  /** Đánh dấu; xe đã có trên bảng giữ mốc và người đưa vào ban đầu. */
  private async mark(
    m: EntityManager,
    c: CaseGarage,
    actorId: string,
    statusChanged: boolean,
    created: boolean,
  ): Promise<CaseWorkshopTrackResult> {
    const trackedAt = c.workshopTrackedAt ?? new Date();
    if (!c.workshopTrackedAt) {
      await m.update(CaseGarage, { id: c.id }, {
        workshopTrackedAt: trackedAt,
        workshopTrackedBy: actorId || null,
      } as never);
    }
    return {
      caseId: c.id,
      caseCode: c.caseCode,
      licensePlate: c.licensePlate ?? null,
      status: c.status,
      workshopTrackedAt: trackedAt.toISOString(),
      statusChanged,
      created,
    };
  }
}
