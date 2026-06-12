import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity({ name: 'erp_audit_logs' })
export class ErpAuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 128, name: 'request_id', nullable: true })
  requestId: string | null;

  @Column({ type: 'uuid', name: 'actor_user_id', nullable: true })
  actorUserId: string | null;

  @Column({ type: 'varchar', length: 255, name: 'actor_email', nullable: true })
  actorEmail: string | null;

  @Column({ type: 'uuid', name: 'actor_employee_id', nullable: true })
  actorEmployeeId: string | null;

  @Column({ type: 'varchar', length: 100, name: 'action_type' })
  actionType: string;

  @Column({ type: 'varchar', length: 100 })
  module: string;

  @Column({ type: 'varchar', length: 100, name: 'entity_type', nullable: true })
  entityType: string | null;

  @Column({ type: 'varchar', length: 255, name: 'entity_id', nullable: true })
  entityId: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  route: string | null;

  @Column({ type: 'varchar', length: 20, name: 'http_method', nullable: true })
  httpMethod: string | null;

  @Column({ type: 'varchar', length: 20, default: 'SUCCESS' })
  status: string;

  @Column({ type: 'text', nullable: true })
  message: string | null;

  @Column({ type: 'varchar', length: 255, name: 'ui_screen', nullable: true })
  uiScreen: string | null;

  @Column({ type: 'varchar', length: 255, name: 'ui_action', nullable: true })
  uiAction: string | null;

  @Column({ type: 'jsonb', name: 'before_snapshot', nullable: true })
  beforeSnapshot: Record<string, unknown> | null;

  @Column({ type: 'jsonb', name: 'after_snapshot', nullable: true })
  afterSnapshot: Record<string, unknown> | null;

  @Column({ type: 'jsonb', name: 'error_snapshot', nullable: true })
  errorSnapshot: Record<string, unknown> | null;

  @Column({ type: 'varchar', length: 64, name: 'ip_address', nullable: true })
  ipAddress: string | null;

  @Column({ type: 'text', name: 'user_agent', nullable: true })
  userAgent: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
