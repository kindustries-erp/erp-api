import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { applyBranchScope } from '@/v2/core/branches-core';
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
 * 3. Xe chưa có: tạo vụ việc NATIVE (biển số, tiếp nhận lúc này, chi nhánh ERP đang chọn hoặc không)
 *    rồi đánh dấu; chặn khi biển số đã có vụ việc đang mở (trong chi nhánh nếu có chọn, không thì mọi nơi).
 */
@Injectable()
export class CaseWorkshopTrackService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly cases: CaseCommandService,
  ) {}

  track(
    branchId: string | undefined,
    dto: TrackWorkshopCaseDto,
    actor: TrackActor,
  ): Promise<CaseWorkshopTrackResult> {
    return this.dataSource.transaction(async (m) => {
      let current = await this.cases.findOwned(m, branchId, dto.caseId, true);
      const changed = Boolean(dto.status) && dto.status !== current.status;
      if (changed) {
        if (!actor.canChangeStatus) {
          throw new ForbiddenException(
            'Bạn không có quyền đổi trạng thái vụ việc khi đưa xe vào bảng.',
          );
        }
        current = await this.cases.updateStatus(
          branchId,
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
    branchId: string | undefined,
    dto: TrackNewWorkshopCaseDto,
    actor: TrackActor,
  ): Promise<CaseWorkshopTrackResult> {
    const actorId = actor.id;
    const plate = dto.licensePlate.trim().toUpperCase();
    const key = normalizePlate(plate);
    if (!key) {
      return Promise.reject(
        new BadRequestException('Biển số phải có chữ hoặc số.'),
      );
    }
    const target = dto.status ?? CaseStatus.INTAKE;
    if (target !== CaseStatus.INTAKE && !actor.canChangeStatus) {
      return Promise.reject(
        new ForbiddenException(
          'Bạn không có quyền tạo xe ở trạng thái khác Tiếp nhận.',
        ),
      );
    }
    return this.dataSource.transaction(async (m) => {
      // Khóa theo biển số để hai người cùng tạo một xe không ra hai vụ việc.
      await m.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
        `workshop:${key}`,
      ]);
      const open = await this.findOpenByPlate(m, branchId, key);
      if (open) {
        throw new ConflictException(
          `Xe ${plate} đã có vụ việc ${open.caseCode} đang mở. Hãy chọn xe trong danh sách.`,
        );
      }
      let created = await this.cases.create(
        branchId,
        {
          licensePlate: plate,
          customerName: dto.customerName?.trim() || undefined,
          requestDescription: dto.requestDescription?.trim() || undefined,
          receivedAt: new Date().toISOString(),
        } as CreateCaseDto,
        actorId,
        m,
      );
      const changed = target !== created.status;
      if (changed) {
        created = await this.cases.updateStatus(
          branchId,
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
  async untrack(branchId: string | undefined, caseId: string): Promise<void> {
    await this.dataSource.transaction(async (m) => {
      await this.cases.findOwned(m, branchId, caseId, true);
      await m.update(CaseGarage, { id: caseId }, {
        workshopTrackedAt: null,
        workshopTrackedBy: null,
      } as never);
    });
  }

  private findOpenByPlate(
    m: EntityManager,
    branchId: string | undefined,
    key: string,
  ) {
    const qb = m
      .getRepository(CaseGarage)
      .createQueryBuilder('c')
      .where('c.is_deleted = false')
      .andWhere('c.external_deleted_at IS NULL')
      .andWhere('c.status NOT IN (:...finished)', { finished: FINISHED })
      .andWhere(`${PLATE_SQL} = :key`, { key });
    applyBranchScope(qb, 'c', branchId);
    return qb.getOne();
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
