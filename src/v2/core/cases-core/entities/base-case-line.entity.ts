import { Column, Index } from 'typeorm';
import { CoreAuditedEntity } from '../../base-core/entities/core-audited.entity';

const MONEY = {
  type: 'numeric',
  precision: 18,
  scale: 2,
  nullable: true,
} as const;

/**
 * Entity nền cho dòng hạng mục (dịch vụ, vật tư, thủ thuật...) của vụ việc. KHÔNG gắn @Entity():
 * module con đặt tên bảng, quan hệ tới header (`case`) và field riêng ngành.
 */
export abstract class BaseCaseLineEntity extends CoreAuditedEntity {
  @Index()
  @Column({ type: 'uuid', name: 'case_id' })
  caseId: string;

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

  @Column({ ...MONEY, name: 'parts_cost' })
  partsCost: string | null;

  @Column({ ...MONEY, name: 'line_discount_rate' })
  lineDiscountRate: string | null;

  @Column({ ...MONEY, name: 'line_discount_amount' })
  lineDiscountAmount: string | null;
}
