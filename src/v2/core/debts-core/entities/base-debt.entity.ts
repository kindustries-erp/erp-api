import { Column, Index, VersionColumn } from 'typeorm';
import { CoreSoftDeletableEntity } from '../../base-core/entities/core-soft-deletable.entity';
import type { DebtDirection } from '../contracts/debt-account.contract';

/**
 * Entity nền cho sổ công nợ: MỘT dòng cho mỗi (nguồn phát sinh, chiều, đối tượng nợ).
 * KHÔNG gắn @Entity(): module con tự đặt tên bảng và khai báo index/unique tổ hợp
 * `(source_type, source_id, direction, party_type)`.
 *
 * Số dư (`settled_amount`, `balance_amount`, `status`) chỉ đổi qua `DebtSettlementPort`,
 * không ghi trực tiếp từ nơi khác. `status` ở đây là trạng thái hiệu lực của dòng nợ
 * (OPEN / SETTLED / VOID), khác `DebtStatus` suy ra từ số tiền trong contract.
 */
export abstract class BaseDebtEntity extends CoreSoftDeletableEntity {
  @Index()
  @Column({ type: 'varchar', length: 100, name: 'branch_external_id' })
  branchExternalId: string;

  /** Loại chứng từ phát sinh nợ, ví dụ CASE, GOODS_RECEIPT, MANUAL. */
  @Column({ type: 'varchar', length: 30, name: 'source_type' })
  sourceType: string;

  @Column({ type: 'varchar', length: 64, name: 'source_id' })
  sourceId: string;

  /** Liên kết về vụ việc (nếu có); không bắt buộc để nguồn khác (kho) dùng chung. */
  @Index()
  @Column({ type: 'uuid', name: 'case_id', nullable: true })
  caseId?: string | null;

  @Column({ type: 'varchar', length: 20 })
  direction: DebtDirection;

  /** Loại đối tượng nợ do module con đặt, ví dụ CUSTOMER, INSURER, SUPPLIER. */
  @Column({ type: 'varchar', length: 20, name: 'party_type' })
  partyType: string;

  /** Trỏ `business-partners-core` khi đã gán đối tác thật. */
  @Index()
  @Column({ type: 'uuid', name: 'partner_id', nullable: true })
  partnerId?: string | null;

  @Column({ type: 'varchar', length: 100, name: 'party_code' })
  partyCode: string;

  @Column({ type: 'varchar', length: 255, name: 'party_name', nullable: true })
  partyName?: string | null;

  @Column({
    type: 'varchar',
    length: 50,
    name: 'license_plate',
    nullable: true,
  })
  licensePlate?: string | null;

  @Column({
    type: 'numeric',
    precision: 18,
    scale: 2,
    name: 'original_amount',
    default: 0,
  })
  originalAmount: string;

  @Column({
    type: 'numeric',
    precision: 18,
    scale: 2,
    name: 'settled_amount',
    default: 0,
  })
  settledAmount: string;

  @Column({
    type: 'numeric',
    precision: 18,
    scale: 2,
    name: 'balance_amount',
    default: 0,
  })
  balanceAmount: string;

  /** Ngày mốc tính tuổi nợ. */
  @Index()
  @Column({ type: 'date', name: 'due_base_date', nullable: true })
  dueBaseDate?: string | null;

  @Column({ type: 'varchar', length: 20, default: 'OPEN' })
  status: string;

  /** Loại khỏi công nợ (theo `exclude_from_debt` / `exclude_from_reports` của nguồn). */
  @Column({ type: 'boolean', default: false })
  excluded: boolean;

  /** SYNC (suy ra từ nguồn), MANUAL (nhập tay), LEGACY (backfill). */
  @Column({ type: 'varchar', length: 20, default: 'SYNC' })
  origin: string;

  /** Tăng mỗi lần lưu, để phát hiện ghi chồng. */
  @VersionColumn()
  version: number;
}
