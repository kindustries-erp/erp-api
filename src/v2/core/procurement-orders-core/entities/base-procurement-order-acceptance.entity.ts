import {
  Column,
  CreateDateColumn,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

/**
 * Biên bản nghiệm thu dịch vụ (chỉ cho dòng SERVICE). Không xóa: hủy bằng `is_voided`.
 */
export abstract class BaseProcurementOrderAcceptanceEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid', name: 'order_id' })
  orderId: string;

  @Index()
  @Column({ type: 'uuid', name: 'order_line_id' })
  orderLineId: string;

  @Column({ type: 'numeric', precision: 18, scale: 3, name: 'qty' })
  qty: string;

  @Column({ type: 'uuid', name: 'accepted_by', nullable: true })
  acceptedBy: string | null;

  @Column({ type: 'timestamptz', name: 'accepted_at' })
  acceptedAt: Date;

  @Column({ type: 'text', name: 'note', nullable: true })
  note: string | null;

  @Column({ type: 'boolean', name: 'is_voided', default: false })
  isVoided: boolean;

  @Column({ type: 'uuid', name: 'voided_by', nullable: true })
  voidedBy: string | null;

  @Column({ type: 'timestamptz', name: 'voided_at', nullable: true })
  voidedAt: Date | null;

  @Column({ type: 'text', name: 'void_reason', nullable: true })
  voidReason: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
