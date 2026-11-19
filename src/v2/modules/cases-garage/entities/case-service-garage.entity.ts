import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  type Relation,
} from 'typeorm';
import { CoreAuditedEntity } from '@/v2/core/base-core';
import type { CaseGarage } from './case-garage.entity';

const MONEY = {
  type: 'numeric',
  precision: 18,
  scale: 2,
  nullable: true,
} as const;

/**
 * Dòng hạng mục (dịch vụ hoặc phụ tùng) của vụ việc v2. Nhiều dòng cho một `cases_garage`.
 * Xe nhập tay: thay theo bộ khi sửa. Xe sync: chiếu từ `kgara_case_services`, xóa bên KGara thì đặt `externalDeletedAt`.
 */
@Entity('case_services_garage')
@Index('UQ_case_services_garage_legacy_service_id', ['legacyServiceId'], {
  unique: true,
})
export class CaseServiceGarage extends CoreAuditedEntity {
  @Index()
  @Column({ type: 'uuid', name: 'case_id' })
  caseId: string;

  @ManyToOne('CaseGarage', (c: any) => c.services, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'case_id' })
  case?: Relation<CaseGarage>;

  /** `kgara_case_services.id` của dòng sync; null với dòng nhập tay. */
  @Column({ type: 'uuid', name: 'legacy_service_id', nullable: true })
  legacyServiceId: string | null;

  /** HdPhieuDichVuChiTietID của KGara. */
  @Column({ type: 'varchar', length: 100, name: 'external_id', nullable: true })
  externalId: string | null;

  @Column({ type: 'varchar', length: 50, name: 'account_key', default: 'MAIN' })
  accountKey: string;

  @Column({ type: 'int', name: 'line_number', default: 0 })
  lineNumber: number;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({
    type: 'varchar',
    length: 100,
    name: 'product_code',
    nullable: true,
  })
  productCode: string | null;

  @Column({
    type: 'varchar',
    length: 255,
    name: 'product_name',
    nullable: true,
  })
  productName: string | null;

  @Column({
    type: 'varchar',
    length: 50,
    name: 'product_type_code',
    nullable: true,
  })
  productTypeCode: string | null;

  @Column({ type: 'varchar', length: 50, name: 'unit_name', nullable: true })
  unitName: string | null;

  @Column({ type: 'numeric', precision: 18, scale: 4, nullable: true })
  quantity: string | null;

  @Column({ ...MONEY, name: 'unit_price' })
  unitPrice: string | null;

  @Column({ ...MONEY, name: 'amount_before_tax' })
  amountBeforeTax: string | null;

  @Column({
    type: 'numeric',
    precision: 5,
    scale: 2,
    name: 'tax_rate',
    nullable: true,
  })
  taxRate: string | null;

  @Column({ ...MONEY, name: 'amount_with_tax' })
  amountWithTax: string | null;

  @Column({ ...MONEY, name: 'labor_hours' })
  laborHours: string | null;

  @Column({ ...MONEY, name: 'service_amount' })
  serviceAmount: string | null;

  @Column({ ...MONEY, name: 'parts_amount' })
  partsAmount: string | null;

  /** Giá vốn phụ tùng (ERP-local, sửa được cả ở xe sync). */
  @Column({ ...MONEY, name: 'parts_cost' })
  partsCost: string | null;

  @Column({ ...MONEY, name: 'line_discount_rate' })
  lineDiscountRate: string | null;

  @Column({ ...MONEY, name: 'line_discount_amount' })
  lineDiscountAmount: string | null;

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
}
