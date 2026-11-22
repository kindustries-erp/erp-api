import { BadRequestException, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { EmployeeManagement } from '@/v2/modules/employees-management/entities/employee-management.entity';
import type { UpdateCaseProgressDto } from '../dto/case-progress.dto';
import { CaseGarage } from '../entities/case-garage.entity';
import { CaseOrigin } from '../entities/case-garage.enums';
import { markOverrides } from '../helpers/case-override.helper';
import { CASE_OVERRIDABLE_KEYS } from '../helpers/case-override.keys';
import { CaseCommandService } from './case-command.service';

/**
 * Ghi tiến độ xe: người phụ trách, công đoạn, %, ngày hẹn xong. Cho cả xe NATIVE và KGARA_SYNC; chỉ
 * `expectedCompletionAt` có nguồn KGara nên được đánh dấu override, các field còn lại là của v2.
 * Không ghi gì sang `kgara_*`. Audit do interceptor ghi nhật ký toàn cục (PATCH có body).
 */
@Injectable()
export class CaseProgressCommandService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly cases: CaseCommandService,
  ) {}

  update(
    branch: string,
    id: string,
    dto: UpdateCaseProgressDto,
    actorId: string,
  ) {
    return this.dataSource.transaction(async (m) => {
      const current = await this.cases.findOwned(m, branch, id, true);
      if (dto.assigneeId) {
        const emp = await m.findOne(EmployeeManagement, {
          where: { id: dto.assigneeId, isDeleted: false },
        });
        if (!emp) {
          throw new BadRequestException('Người phụ trách không tồn tại.');
        }
        if (
          current.branchId &&
          emp.branchId &&
          emp.branchId !== current.branchId
        ) {
          throw new BadRequestException(
            'Người phụ trách thuộc chi nhánh khác.',
          );
        }
      }
      const patch: Record<string, unknown> = {};
      if (dto.assigneeId !== undefined) patch.assigneeId = dto.assigneeId;
      if (dto.progressStage !== undefined)
        patch.progressStage = dto.progressStage;
      if (dto.progressPercent !== undefined) {
        patch.progressPercent = dto.progressPercent;
      }
      if (dto.expectedCompletionAt !== undefined) {
        patch.expectedCompletionAt = dto.expectedCompletionAt
          ? new Date(dto.expectedCompletionAt)
          : null;
      }
      const extra: Record<string, unknown> = {};
      if (
        current.origin === CaseOrigin.KGARA_SYNC &&
        'expectedCompletionAt' in patch
      ) {
        extra.overrides = markOverrides(
          { expectedCompletionAt: patch.expectedCompletionAt },
          current.sourceSnapshot,
          current.overrides,
          CASE_OVERRIDABLE_KEYS,
        );
      }
      await m.update(CaseGarage, { id }, {
        ...patch,
        ...extra,
        progressUpdatedAt: new Date(),
        progressUpdatedBy: actorId || null,
      } as never);
      return this.cases.reload(m, id);
    });
  }
}
