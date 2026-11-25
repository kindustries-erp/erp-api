import { BadRequestException } from '@nestjs/common';
import { EntityManager, IsNull, LessThan, MoreThan, Not } from 'typeorm';
import { CaseGarage } from '../entities/case-garage.entity';
import type { CaseStatus } from '../entities/case-garage.enums';
import { CaseProgressLogGarage } from '../entities/case-progress-log-garage.entity';
import { CaseProgressLogKind } from '../entities/case-progress.enums';
import { isStageOf } from './case-progress-stage.map';

/**
 * Đóng dòng STAGE đang mở của vụ việc tại `at` (gọi trong transaction đã khóa dòng vụ việc).
 * `strict`: báo 400 khi `at` trước giờ bắt đầu của công đoạn đang mở (nhập tay); không strict thì lấy
 * mốc muộn hơn để không vi phạm `ended_at >= started_at` (đổi status cha).
 */
export async function closeOpenStage(
  m: EntityManager,
  caseId: string,
  at: Date,
  actorId: string,
  strict = false,
): Promise<void> {
  const open = await m.findOne(CaseProgressLogGarage, {
    where: {
      caseId,
      kind: CaseProgressLogKind.STAGE,
      endedAt: IsNull(),
      isDeleted: false,
    },
  });
  if (!open?.startedAt) return;
  const before = at.getTime() < open.startedAt.getTime();
  if (before && strict) {
    throw new BadRequestException(
      'Giờ bắt đầu trước giờ bắt đầu của công đoạn đang mở.',
    );
  }
  await m.update(CaseProgressLogGarage, { id: open.id }, {
    endedAt: before ? open.startedAt : at,
    updatedBy: actorId || null,
  } as never);
}

/**
 * Sửa tay giờ của một dòng STAGE: không chồng lên công đoạn trước (bắt đầu sau giờ kết thúc của nó)
 * và công đoạn sau (kết thúc trước giờ bắt đầu của nó). So với vị trí cũ của dòng trong timeline.
 */
export async function assertStageWindow(
  m: EntityManager,
  log: Pick<CaseProgressLogGarage, 'id' | 'caseId' | 'startedAt'>,
  startedAt: Date,
  endedAt: Date | null,
): Promise<void> {
  const base = {
    caseId: log.caseId,
    kind: CaseProgressLogKind.STAGE,
    isDeleted: false,
    id: Not(log.id),
  };
  const prev = await m.findOne(CaseProgressLogGarage, {
    where: { ...base, startedAt: LessThan(log.startedAt) },
    order: { startedAt: 'DESC' },
  });
  if (prev?.endedAt && startedAt.getTime() < prev.endedAt.getTime()) {
    throw new BadRequestException('Giờ bắt đầu chồng lên công đoạn trước.');
  }
  const next = await m.findOne(CaseProgressLogGarage, {
    where: { ...base, startedAt: MoreThan(log.startedAt) },
    order: { startedAt: 'ASC' },
  });
  if (!next) return;
  const end = endedAt ?? startedAt;
  if (end.getTime() > next.startedAt.getTime()) {
    throw new BadRequestException('Giờ kết thúc chồng lên công đoạn sau.');
  }
}

/**
 * Status vụ việc vừa đổi (đổi tay, về giá trị KGara, đồng bộ từ KGara): đóng công đoạn đang mở và bỏ
 * `progressStage` không còn thuộc status mới. Gọi trong transaction đã đổi status.
 */
export async function syncStageOnStatusChange(
  m: EntityManager,
  c: Pick<CaseGarage, 'id' | 'progressStage'>,
  nextStatus: CaseStatus,
  actorId: string,
  at = new Date(),
): Promise<void> {
  await closeOpenStage(m, c.id, at, actorId);
  if (c.progressStage && !isStageOf(nextStatus, c.progressStage)) {
    await m.update(CaseGarage, { id: c.id }, { progressStage: null } as never);
  }
}

/**
 * Đổi công đoạn ngoài trang tiến độ xưởng (ví dụ `PATCH :id/progress`): đóng dòng đang mở, mở dòng
 * STAGE mới tại `at` để nhật ký và `progressStage` của xe khớp nhau. `stage` null thì chỉ đóng.
 */
export async function switchStageLog(
  m: EntityManager,
  c: Pick<CaseGarage, 'id' | 'status'>,
  stage: string | null,
  actorId: string,
  at = new Date(),
): Promise<void> {
  await closeOpenStage(m, c.id, at, actorId);
  if (!stage) return;
  await m.insert(CaseProgressLogGarage, {
    caseId: c.id,
    branchExternalId: null,
    kind: CaseProgressLogKind.STAGE,
    caseStatus: c.status,
    stage,
    note: null,
    workerId: null,
    workerName: null,
    startedAt: at,
    endedAt: null,
    createdBy: actorId || null,
    updatedBy: actorId || null,
  } as never);
}
