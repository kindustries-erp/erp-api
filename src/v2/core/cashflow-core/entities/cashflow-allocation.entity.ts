import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

/**
 * Phân bổ một khoản thực thu/chi vào một dự thu/dự chi. Số còn lại của dự thu/dự chi
 * tính từ bảng này, không lưu trên header. Bảng `cashflow_allocations`.
 */
@Entity('cashflow_allocations')
export class CashflowAllocation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'payment_id' })
  paymentId: string;

  @Column({ type: 'uuid', name: 'forecast_id' })
  forecastId: string;

  @Column({ type: 'numeric', precision: 18, scale: 2, name: 'amount' })
  amount: string;

  @Column({ type: 'uuid', name: 'created_by', nullable: true })
  createdBy: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
