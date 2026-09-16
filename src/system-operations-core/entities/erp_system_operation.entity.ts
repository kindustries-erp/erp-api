import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type SystemOperationModule =
  | 'INVENTORY'
  | 'PRODUCTION'
  | 'INVOICES'
  | 'ACCOUNTING'
  | 'AFTER_SALES'
  | 'SYSTEM_JOBS'
  | (string & {});

export type SystemOperationScope =
  | 'GLOBAL'
  | 'MODULE'
  | 'DOCUMENT'
  | 'RESOURCE'
  | (string & {});

export type SystemOperationStatus =
  | 'PROCESSING'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED'
  | (string & {});

@Entity({ name: 'erp_system_operations' })
export class ErpSystemOperation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Phân hệ nghiệp vụ: INVENTORY, PRODUCTION, INVOICES, ACCOUNTING, ... */
  @Column({ type: 'varchar', length: 50, name: 'module' })
  module: SystemOperationModule;

  /** Loại tác vụ cụ thể: GOODS_RECEIPT_POSTING, INVOICE_SYNC_GDT, MONTHLY_CLOSING, ... */
  @Column({ type: 'varchar', length: 100, name: 'operation_type' })
  operationType: string;

  /** Phạm vi ảnh hưởng: GLOBAL, MODULE, DOCUMENT, RESOURCE */
  @Column({
    type: 'varchar',
    length: 50,
    name: 'scope_type',
    default: 'MODULE',
  })
  scopeType: SystemOperationScope;

  /** ID của đối tượng bị khóa (ID phiếu, ID đơn, ...) */
  @Column({ type: 'varchar', length: 255, name: 'target_id', nullable: true })
  targetId: string | null;

  /** Mã số hiển thị người dùng (VD: NK-20260914-001) */
  @Column({ type: 'varchar', length: 100, name: 'target_no', nullable: true })
  targetNo: string | null;

  /** ID người dùng thực hiện (hoặc null nếu do cron/system) */
  @Column({ type: 'uuid', name: 'user_id', nullable: true })
  userId: string | null;

  /** Tên người dùng thực hiện để hiển thị thông báo/tooltip */
  @Column({ type: 'varchar', length: 255, name: 'user_name', nullable: true })
  userName: string | null;

  /** Trạng thái tác vụ: PROCESSING, COMPLETED, FAILED, CANCELLED */
  @Column({
    type: 'varchar',
    length: 50,
    name: 'status',
    default: 'PROCESSING',
  })
  status: SystemOperationStatus;

  /** Cờ quyết định có cần khóa nút trên UI các máy khác hay không */
  @Column({
    type: 'boolean',
    name: 'is_blocking_ui',
    default: true,
  })
  isBlockingUi: boolean;

  /** Danh sách các hành động bị khóa (VD: ['CREATE_RECEIPT', 'CREATE_ISSUE']) */
  @Column({
    type: 'text',
    array: true,
    name: 'blocked_actions',
    nullable: true,
  })
  blockedActions: string[] | null;

  /** Dữ liệu tiến độ: { total, current, percent, stage, message } */
  @Column({ type: 'jsonb', name: 'progress_data', nullable: true })
  progressData: Record<string, any> | null;

  /** Metadata mở rộng tự do */
  @Column({ type: 'jsonb', name: 'metadata', nullable: true })
  metadata: Record<string, any> | null;

  /** Thời điểm hết hạn khóa (Fail-safe auto-expire chống deadlock) */
  @Column({ type: 'timestamptz', name: 'expires_at' })
  expiresAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
