import { Column, Index } from 'typeorm';
import { CoreAuditedEntity } from '../../base-core/entities/core-audited.entity';
import type { DebtAllocationSource } from '../contracts/debt-allocation.contract';

/**
 * Entity nền cho phân bổ thanh toán vào khoản nợ. Bất biến: không sửa số tiền, chỉ đảo
 * (`reversed_at` + dòng đảo trỏ `reversal_of_id`).
 * KHÔNG gắn @Entity(): module con đặt tên bảng, FK `debt_id` / `voucher_id`
 * và unique `idempotency_key`.
 */
export abstract class BaseDebtAllocationEntity extends CoreAuditedEntity {
  @Index()
  @Column({ type: 'varchar', length: 100, name: 'branch_external_id' })
  branchExternalId: string;

  @Index()
  @Column({ type: 'uuid', name: 'debt_id' })
  debtId: string;

  @Column({ type: 'varchar', length: 30, name: 'source_type' })
  sourceType: DebtAllocationSource;

  /** Mã chứng từ nguồn; null khi nhập tay. */
  @Column({ type: 'varchar', length: 64, name: 'source_id', nullable: true })
  sourceId?: string | null;

  /** Phiếu thu chi sinh ra phân bổ (nếu có). */
  @Index()
  @Column({ type: 'uuid', name: 'voucher_id', nullable: true })
  voucherId?: string | null;

  /** Luôn dương; hướng do khoản nợ quyết định. */
  @Column({ type: 'numeric', precision: 18, scale: 2 })
  amount: string;

  /** Bên trả: KH hoặc BH (bảo hiểm). */
  @Column({ type: 'varchar', length: 10, name: 'payer_type', default: 'KH' })
  payerType: string;

  @Column({ type: 'date', name: 'trans_date', nullable: true })
  transDate?: string | null;

  @Column({ type: 'varchar', length: 128, name: 'idempotency_key' })
  idempotencyKey: string;

  @Column({ type: 'timestamptz', name: 'reversed_at', nullable: true })
  reversedAt?: Date | null;

  @Column({ type: 'uuid', name: 'reversal_of_id', nullable: true })
  reversalOfId?: string | null;

  /** NATIVE (ghi ở v2) hoặc LEGACY (backfill từ settlement cũ, sửa được bằng đảo và phân bổ lại). */
  @Column({ type: 'varchar', length: 20, default: 'NATIVE' })
  origin: string;

  @Column({ type: 'varchar', length: 64, name: 'actor_id', nullable: true })
  actorId?: string | null;
}
