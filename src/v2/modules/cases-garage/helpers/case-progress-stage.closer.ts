import { BadRequestException } from '@nestjs/common';
import { EntityManager, IsNull } from 'typeorm';
import { CaseProgressLogGarage } from '../entities/case-progress-log-garage.entity';
import { CaseProgressLogKind } from '../entities/case-progress.enums';

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
