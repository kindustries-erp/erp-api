import { Column, Index } from 'typeorm';
import { CoreSoftDeletableEntity } from '../../base-core/entities/core-soft-deletable.entity';

const MONEY = {
  type: 'numeric',
  precision: 18,
  scale: 2,
  nullable: true,
} as const;

/**
 * Entity nền cho "vụ việc" (case): một lượt tiếp nhận và xử lý cho một khách hàng, dùng chung nhiều ngành
 * (sửa xe, bảo hành thiết bị, phòng khám, công trình, ticket hỗ trợ...). KHÔNG gắn @Entity(): module con
 * đặt tên bảng và thêm field riêng ngành. Bảng use case → field: `.agents/skills/modules/cases-core/SKILL.md`.
 * `TStatus` là tập trạng thái do module con định nghĩa.
 */
export abstract class BaseCaseEntity<
  TStatus extends string = string,
> extends CoreSoftDeletableEntity {
  /** Số chứng từ / mã vụ việc. */
  @Index()
  @Column({ type: 'varchar', length: 100, name: 'case_code' })
  caseCode: string;

  @Column({ type: 'uuid', name: 'branch_id', nullable: true })
  branchId: string | null;

  // ── Khách hàng và đối tượng thanh toán ────────────────────────────────────
  @Column({
    type: 'varchar',
    length: 100,
    name: 'customer_code',
    nullable: true,
  })
  customerCode: string | null;

  @Column({
    type: 'varchar',
    length: 255,
    name: 'customer_name',
    nullable: true,
  })
  customerName: string | null;

  @Index()
  @Column({ type: 'varchar', length: 100, name: 'payer_code', nullable: true })
  payerCode: string | null;

  @Column({ type: 'varchar', length: 255, name: 'payer_name', nullable: true })
  payerName: string | null;

  // ── Trạng thái (vòng đời do module con định nghĩa) ────────────────────────
  @Column({ type: 'varchar', length: 30 })
  status: TStatus;

  // ── Ngày ──────────────────────────────────────────────────────────────────
  @Column({ type: 'timestamptz', name: 'issued_at', nullable: true })
  issuedAt: Date | null;

  @Column({ type: 'timestamptz', name: 'received_at', nullable: true })
  receivedAt: Date | null;

  @Column({ type: 'timestamptz', name: 'started_at', nullable: true })
  startedAt: Date | null;

  @Column({
    type: 'timestamptz',
    name: 'expected_completion_at',
    nullable: true,
  })
  expectedCompletionAt: Date | null;

  @Column({ type: 'timestamptz', name: 'completed_at', nullable: true })
  completedAt: Date | null;

  @Column({ type: 'timestamptz', name: 'delivered_at', nullable: true })
  deliveredAt: Date | null;

  // ── Nội dung xử lý và tiến độ ─────────────────────────────────────────────
  @Column({ type: 'text', name: 'request_description', nullable: true })
  requestDescription: string | null;

  @Column({ type: 'text', nullable: true })
  diagnosis: string | null;

  /** Người phụ trách chính (nhân viên). Tham chiếu mềm, không FK. */
  @Index()
  @Column({ type: 'uuid', name: 'assignee_id', nullable: true })
  assigneeId: string | null;

  /** Mã công đoạn hiện tại; danh sách giá trị do module con định nghĩa. */
  @Column({
    type: 'varchar',
    length: 30,
    name: 'progress_stage',
    nullable: true,
  })
  progressStage: string | null;

  /** Tiến độ 0–100 do người nhập, độc lập với `status`. */
  @Column({ type: 'smallint', name: 'progress_percent', nullable: true })
  progressPercent: number | null;

  @Column({ type: 'timestamptz', name: 'progress_updated_at', nullable: true })
  progressUpdatedAt: Date | null;

  @Column({ type: 'uuid', name: 'progress_updated_by', nullable: true })
  progressUpdatedBy: string | null;

  // ── Tiền (numeric giữ string theo TypeORM, response ép number) ───────────
  @Column({ ...MONEY, name: 'total_amount_with_tax' })
  totalAmountWithTax: string | null;

  @Column({ ...MONEY, name: 'paid_amount' })
  paidAmount: string | null;

  @Column({ ...MONEY, name: 'outstanding_amount' })
  outstandingAmount: string | null;

  @Column({ ...MONEY, name: 'revenue' })
  revenue: string | null;

  @Column({ ...MONEY, name: 'cost' })
  cost: string | null;

  @Column({ ...MONEY, name: 'profit' })
  profit: string | null;

  // ── Phân loại và ghi chú ──────────────────────────────────────────────────
  @Index()
  @Column({ type: 'uuid', name: 'category_id', nullable: true })
  categoryId: string | null;

  @Index()
  @Column({ type: 'varchar', length: 100, nullable: true })
  classification: string | null;

  @Column({ type: 'text', name: 'internal_notes', nullable: true })
  internalNotes: string | null;

  @Column({ type: 'uuid', name: 'created_by', nullable: true })
  createdBy: string | null;
}
