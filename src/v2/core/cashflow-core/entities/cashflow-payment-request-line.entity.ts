import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

/**
 * Dòng DNTT. Trỏ một dự chi (`forecast_id`) hoặc một chứng từ khác qua (`ref_type`, `ref_id`),
 * ví dụ GARAGE_PO. Bảng `cashflow_payment_request_lines`.
 */
@Entity('cashflow_payment_request_lines')
export class CashflowPaymentRequestLine {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'request_id' })
  requestId: string;

  @Column({ type: 'uuid', name: 'forecast_id', nullable: true })
  forecastId: string | null;

  @Column({ type: 'varchar', length: 32, name: 'ref_type', nullable: true })
  refType: string | null;

  @Column({ type: 'uuid', name: 'ref_id', nullable: true })
  refId: string | null;

  @Column({ type: 'numeric', precision: 18, scale: 2, name: 'amount' })
  amount: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
