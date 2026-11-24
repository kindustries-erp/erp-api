import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  type Relation,
} from 'typeorm';
import { CoreSoftDeletableEntity } from '@/v2/core/base-core/entities/core-soft-deletable.entity';
import type { CaseGarage } from './case-garage.entity';
import { CaseProgressLogKind } from './case-progress.enums';

/**
 * Nhật ký tiến độ xưởng của một vụ việc garage.
 * - `STAGE`: một lần ở status nhỏ (công đoạn); `endedAt` null là công đoạn đang mở (tối đa một dòng mở mỗi xe).
 * - `NOTE`: ghi chú giữa chừng; `startedAt` là thời điểm ghi.
 * `workerId` trỏ mềm `employees_management.id` (không FK, giống `assignee_id`); `workerName` là giá trị
 * song song sửa được (chuẩn V2LinkedField). Bảng riêng v2, không có nguồn KGara.
 */
@Entity('case_progress_logs_garage')
@Index('IDX_case_progress_logs_garage_case_started', ['caseId', 'startedAt'])
export class CaseProgressLogGarage extends CoreSoftDeletableEntity {
  @Column({ type: 'uuid', name: 'case_id' })
  caseId: string;

  @ManyToOne('CaseGarage', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'case_id' })
  case?: Relation<CaseGarage>;

  @Column({ type: 'varchar', length: 100, name: 'branch_external_id' })
  branchExternalId: string;

  @Column({ type: 'varchar', length: 10 })
  kind: CaseProgressLogKind;

  /** Status cha (`CaseStatus`) lúc ghi. */
  @Column({ type: 'varchar', length: 20, name: 'case_status' })
  caseStatus: string;

  /** Status nhỏ (`CaseProgressStage`); bắt buộc với `STAGE`. */
  @Column({ type: 'varchar', length: 30, nullable: true })
  stage: string | null;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @Column({ type: 'uuid', name: 'worker_id', nullable: true })
  workerId: string | null;

  @Column({ type: 'varchar', length: 255, name: 'worker_name', nullable: true })
  workerName: string | null;

  @Column({ type: 'timestamptz', name: 'started_at' })
  startedAt: Date;

  @Column({ type: 'timestamptz', name: 'ended_at', nullable: true })
  endedAt: Date | null;

  @Column({ type: 'uuid', name: 'created_by', nullable: true })
  createdBy: string | null;

  @Column({ type: 'uuid', name: 'updated_by', nullable: true })
  updatedBy: string | null;
}
