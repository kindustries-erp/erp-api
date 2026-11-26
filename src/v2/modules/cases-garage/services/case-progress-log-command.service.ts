import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { EmployeeManagement } from '@/v2/modules/employees-management/entities/employee-management.entity';
import type {
  CaseProgressLogItem,
  CreateCaseProgressLogDto,
  UpdateCaseProgressLogDto,
} from '../dto/case-progress-log.dto';
import { CaseGarage } from '../entities/case-garage.entity';
import { CaseProgressLogGarage } from '../entities/case-progress-log-garage.entity';
import { CaseProgressLogKind } from '../entities/case-progress.enums';
import { toProgressLogItem } from '../helpers/case-progress-log.mapper';
import {
  assertStageWindow,
  closeOpenStage,
} from '../helpers/case-progress-stage.closer';
import { isStageOf } from '../helpers/case-progress-stage.map';
import { CaseCommandService } from './case-command.service';

/** Cho phép lệch đồng hồ máy nhân viên tối đa 5 phút khi nhập giờ. */
const FUTURE_TOLERANCE_MS = 5 * 60_000;

interface WorkerInput {
  workerId?: string | null;
  workerName?: string | null;
}

/**
 * Ghi, sửa tay, xóa mềm nhật ký tiến độ xưởng (`case_progress_logs_garage`). Đổi công đoạn đóng dòng
 * STAGE đang mở rồi mở dòng mới trong cùng transaction, khóa `pessimistic_write` dòng vụ việc để không
 * có hai công đoạn mở. Status nhỏ là dữ liệu riêng v2: không tạo override, không ghi sang KGara.
 */
@Injectable()
export class CaseProgressLogCommandService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly cases: CaseCommandService,
  ) {}

  create(
    branchId: string | undefined,
    caseId: string,
    dto: CreateCaseProgressLogDto,
    actorId: string,
    now = new Date(),
  ): Promise<CaseProgressLogItem> {
    return this.dataSource.transaction(async (m) => {
      const current = await this.cases.findOwned(m, branchId, caseId, true);
      const worker = await this.resolveWorker(m, current, dto);
      const startedAt = parseTime(dto.startedAt, now) ?? now;
      const isStage = dto.kind === CaseProgressLogKind.STAGE;
      if (isStage) {
        if (!dto.stage || !isStageOf(current.status, dto.stage)) {
          throw new BadRequestException(
            `Công đoạn ${dto.stage ?? ''} không thuộc trạng thái ${current.status}.`,
          );
        }
        await closeOpenStage(m, caseId, startedAt, actorId, true);
      } else if (!dto.note?.trim()) {
        throw new BadRequestException('Thiếu nội dung ghi chú.');
      }
      const saved = await m.save(
        m.create(CaseProgressLogGarage, {
          caseId,
          branchExternalId: null,
          kind: dto.kind,
          caseStatus: current.status,
          stage: isStage ? (dto.stage ?? null) : null,
          note: dto.note?.trim() || null,
          workerId: worker.workerId,
          workerName: worker.workerName,
          startedAt,
          endedAt: null,
          createdBy: actorId || null,
          updatedBy: actorId || null,
        }),
      );
      await m.update(CaseGarage, { id: caseId }, {
        ...(isStage ? { progressStage: dto.stage } : {}),
        ...(isStage && worker.workerId ? { assigneeId: worker.workerId } : {}),
        progressUpdatedAt: now,
        progressUpdatedBy: actorId || null,
      } as never);
      return toProgressLogItem(saved, now);
    });
  }

  update(
    branchId: string | undefined,
    logId: string,
    dto: UpdateCaseProgressLogDto,
    actorId: string,
    now = new Date(),
  ): Promise<CaseProgressLogItem> {
    return this.dataSource.transaction(async (m) => {
      const log = await this.findLog(m, logId);
      const current = await this.cases.findOwned(m, branchId, log.caseId);
      const patch: Partial<CaseProgressLogGarage> = {};
      if (dto.note !== undefined) patch.note = dto.note?.trim() || null;
      if (dto.workerId !== undefined || dto.workerName !== undefined) {
        Object.assign(
          patch,
          await this.resolveWorker(m, current, {
            workerId: dto.workerId !== undefined ? dto.workerId : log.workerId,
            workerName:
              dto.workerName !== undefined
                ? dto.workerName
                : dto.workerId !== undefined
                  ? null
                  : log.workerName,
          }),
        );
      }
      const startedAt = parseTime(dto.startedAt, now) ?? log.startedAt;
      let endedAt = log.endedAt;
      if (dto.endedAt === null) {
        throw new BadRequestException(
          'Không bỏ được giờ kết thúc của công đoạn đã đóng.',
        );
      }
      if (dto.endedAt !== undefined) {
        if (log.kind !== CaseProgressLogKind.STAGE || !log.endedAt) {
          throw new BadRequestException(
            'Chỉ sửa giờ kết thúc của công đoạn đã đóng.',
          );
        }
        endedAt = parseTime(dto.endedAt, now);
      }
      if (endedAt && endedAt.getTime() < startedAt.getTime()) {
        throw new BadRequestException('Giờ kết thúc trước giờ bắt đầu.');
      }
      const timeChanged =
        startedAt.getTime() !== log.startedAt.getTime() ||
        endedAt?.getTime() !== log.endedAt?.getTime();
      if (log.kind === CaseProgressLogKind.STAGE && timeChanged) {
        await assertStageWindow(m, log, startedAt, endedAt);
      }
      patch.startedAt = startedAt;
      patch.endedAt = endedAt;
      patch.updatedBy = actorId || null;
      await m.update(CaseProgressLogGarage, { id: log.id }, patch as never);
      return toProgressLogItem(
        { ...log, ...patch } as CaseProgressLogGarage,
        now,
      );
    });
  }

  remove(
    branchId: string | undefined,
    logId: string,
    actorId: string,
  ): Promise<void> {
    return this.dataSource.transaction(async (m) => {
      const log = await this.findLog(m, logId);
      await this.cases.findOwned(m, branchId, log.caseId);
      await m.update(CaseProgressLogGarage, { id: log.id }, {
        isDeleted: true,
        updatedBy: actorId || null,
      } as never);
      const isOpenStage =
        log.kind === CaseProgressLogKind.STAGE && log.endedAt == null;
      if (isOpenStage) {
        await m.update(CaseGarage, { id: log.caseId }, {
          progressStage: null,
          progressUpdatedAt: new Date(),
          progressUpdatedBy: actorId || null,
        } as never);
      }
    });
  }

  /** Chi nhánh kiểm qua vụ việc cha (`findOwned`), không theo UUID KGara của nhật ký. */
  private async findLog(
    m: EntityManager,
    logId: string,
  ): Promise<CaseProgressLogGarage> {
    const log = await m.findOne(CaseProgressLogGarage, {
      where: { id: logId, isDeleted: false },
      lock: { mode: 'pessimistic_write' },
    });
    if (!log) throw new NotFoundException('Không tìm thấy nhật ký tiến độ.');
    return log;
  }

  /** Người làm: kiểm nhân viên tồn tại và cùng chi nhánh; tên bỏ trống thì lấy tên nhân viên. */
  private async resolveWorker(
    m: EntityManager,
    current: CaseGarage,
    input: WorkerInput,
  ): Promise<{ workerId: string | null; workerName: string | null }> {
    const name = input.workerName?.trim() || null;
    if (!input.workerId) return { workerId: null, workerName: name };
    const emp = await m.findOne(EmployeeManagement, {
      where: { id: input.workerId, isDeleted: false },
    });
    if (!emp) throw new BadRequestException('Người làm không tồn tại.');
    if (current.branchId && emp.branchId && emp.branchId !== current.branchId) {
      throw new BadRequestException('Người làm thuộc chi nhánh khác.');
    }
    return { workerId: emp.id, workerName: name ?? emp.fullName ?? null };
  }
}

/** Giờ nhập tay: không quá hiện tại + 5 phút. */
function parseTime(value: string | undefined, now: Date): Date | null {
  if (value === undefined || value === null) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    throw new BadRequestException('Thời gian không hợp lệ.');
  }
  if (d.getTime() > now.getTime() + FUTURE_TOLERANCE_MS) {
    throw new BadRequestException('Thời gian không được ở tương lai.');
  }
  return d;
}
