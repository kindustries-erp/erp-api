import { Column, Index } from 'typeorm';
import { CoreHeaderEntity } from '../../base-core/entities/core-header.entity';
import { IVoucherHeader } from '../contracts/voucher.contract';

/**
 * Abstract Base Entity cho bảng Header chứng từ Nhập kho (Goods Receipt).
 * KHÔNG gắn @Entity() ở đây để các module con tự định nghĩa tên bảng riêng biệt.
 * Kế thừa id, extraData, timestamps, isDeleted, status (DRAFT), createdBy từ lớp header chung.
 */
export abstract class BaseGoodsReceiptEntity
  extends CoreHeaderEntity
  implements IVoucherHeader
{
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 128, name: 'receipt_no' })
  receiptNo: string;

  @Index()
  @Column({ type: 'timestamptz', name: 'receipt_date' })
  receiptDate: Date;

  @Index()
  @Column({ type: 'uuid', name: 'supplier_id', nullable: true })
  supplierId?: string | null;

  @Column({
    type: 'varchar',
    length: 255,
    name: 'supplier_name',
    nullable: true,
  })
  supplierName?: string;

  @Index()
  @Column({ type: 'uuid', name: 'branch_id', nullable: true })
  branchId?: string | null;

  @Column({
    type: 'varchar',
    length: 255,
    name: 'branch_name',
    nullable: true,
  })
  branchName?: string;

  @Column({
    type: 'numeric',
    precision: 18,
    scale: 2,
    name: 'total_amount',
    default: 0,
  })
  totalAmount: string;

  @Column({ type: 'text', name: 'remarks', nullable: true })
  remarks?: string;
}
