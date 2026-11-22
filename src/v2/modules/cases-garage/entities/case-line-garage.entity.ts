import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  type Relation,
} from 'typeorm';
import { BaseCaseLineEntity } from '@/v2/core/cases-core';
import { DEFAULT_CASE_ACCOUNT_KEY } from './case-garage.enums';
import type { CaseGarage } from './case-garage.entity';

const MONEY = {
  type: 'numeric',
  precision: 18,
  scale: 2,
  nullable: true,
} as const;

/**
 * Dòng hạng mục (dịch vụ hoặc phụ tùng) của vụ việc garage v2. Kế thừa `BaseCaseLineEntity` (cases-core).
 * Xe nhập tay: thay theo bộ khi sửa. Xe sync: chiếu từ `kgara_case_services`, nối bằng
 * `(accountKey, externalId)`; xóa bên KGara thì đặt `externalDeletedAt`.
 * `sourceSnapshot` giữ giá trị sync mới nhất, `overrides` giữ các field đã sửa ở v2 (xem SKILL cases-garage).
 */
@Entity('case_lines_garage')
@Index(
  'UQ_case_lines_garage_account_external_id',
  ['accountKey', 'externalId'],
  {
    unique: true,
  },
)
export class CaseLineGarage extends BaseCaseLineEntity {
  @ManyToOne('CaseGarage', (c: any) => c.services, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'case_id' })
  case?: Relation<CaseGarage>;

  /** HdPhieuDichVuChiTietID của KGara; null với dòng nhập tay. */
  @Column({ type: 'varchar', length: 100, name: 'external_id', nullable: true })
  externalId: string | null;

  @Column({
    type: 'varchar',
    length: 50,
    name: 'account_key',
    default: DEFAULT_CASE_ACCOUNT_KEY,
  })
  accountKey: string;

  @Column({
    type: 'varchar',
    length: 50,
    name: 'product_type_code',
    nullable: true,
  })
  productTypeCode: string | null;

  @Column({ ...MONEY, name: 'surcharge_amount' })
  surchargeAmount: string | null;

  @Column({
    type: 'varchar',
    length: 100,
    name: 'warehouse_code',
    nullable: true,
  })
  warehouseCode: string | null;

  @Index()
  @Column({ type: 'timestamptz', name: 'external_deleted_at', nullable: true })
  externalDeletedAt: Date | null;

  /** Giá trị mới nhất sync từ v1 (khóa camelCase). */
  @Column({ type: 'jsonb', name: 'source_snapshot', default: () => "'{}'" })
  sourceSnapshot: Record<string, unknown>;

  /** Tập field đã sửa ở v2 (khóa camelCase → true); `_deleted` là xóa mềm dòng. */
  @Column({ type: 'jsonb', name: 'overrides', default: () => "'{}'" })
  overrides: Record<string, true>;
}
