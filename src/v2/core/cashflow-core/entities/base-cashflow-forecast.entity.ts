import {
  Column,
  CreateDateColumn,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { BaseApprovalFields } from '@/v2/core/approval-core/entities/base-approval-fields';

/**
 * Entity nền của dự thu / dự chi (cashflow-core). Chứa toàn bộ cột dùng chung.
 * Bảng cụ thể `cashflow_forecasts` khai báo ở `cashflow-forecast.entity.ts`.
 * Xóa mềm bằng `isDeleted`, theo quy chuẩn ERP.
 * Số dư còn lại không lưu ở đây: tính từ `cashflow_allocations`.
 */
export abstract class BaseCashflowForecastEntity extends BaseApprovalFields {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 64, name: 'code' })
  code: string;

  /** IN = dự thu, OUT = dự chi. */
  @Column({ type: 'varchar', length: 3, name: 'direction' })
  direction: 'IN' | 'OUT';

  /** PURCHASE = đề nghị mua hàng (có dòng hàng), COMMISSION, CASE_RECEIVABLE, OTHER. */
  @Column({ type: 'varchar', length: 32, name: 'kind' })
  kind: 'PURCHASE' | 'COMMISSION' | 'CASE_RECEIVABLE' | 'OTHER';

  /** AUTO = sinh từ nghiệp vụ, MANUAL = người dùng tạo. */
  @Column({ type: 'varchar', length: 16, name: 'source', default: 'MANUAL' })
  source: 'AUTO' | 'MANUAL';

  @Column({ type: 'varchar', length: 64, name: 'source_type', nullable: true })
  sourceType: string | null;

  @Column({ type: 'uuid', name: 'source_id', nullable: true })
  sourceId: string | null;

  @Column({ type: 'uuid', name: 'partner_id', nullable: true })
  partnerId: string | null;

  @Column({
    type: 'varchar',
    length: 255,
    name: 'partner_name',
    nullable: true,
  })
  partnerName: string | null;

  @Column({ type: 'uuid', name: 'branch_id', nullable: true })
  branchId: string | null;

  /** Số tiền gốc. Với dự chi mua hàng bằng tổng dòng hàng. Kiểu string vì TypeORM trả numeric dạng chuỗi. */
  @Column({
    type: 'numeric',
    precision: 18,
    scale: 2,
    name: 'amount',
    default: 0,
  })
  amount: string;

  @Column({ type: 'date', name: 'planned_date', nullable: true })
  plannedDate: string | null;

  /**
   * Trạng thái. Có duyệt: DRAFT -> PENDING_APPROVAL -> OPEN / REJECTED.
   * Không duyệt: tạo ra là OPEN. Sau đó PARTIAL, SETTLED, CANCELLED theo phân bổ.
   */
  @Column({ type: 'varchar', length: 32, name: 'status', default: 'DRAFT' })
  status: string;

  /** Chép từ cấu hình duyệt tại thời điểm tạo. Đổi cấu hình sau này không đổi dòng cũ. */
  @Column({ type: 'boolean', name: 'requires_approval', default: false })
  requiresApproval: boolean;

  @Column({ type: 'text', name: 'note', nullable: true })
  note: string | null;

  @Column({ type: 'boolean', name: 'is_deleted', default: false })
  isDeleted: boolean;

  @Column({ type: 'uuid', nullable: true, name: 'created_by' })
  createdBy: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
