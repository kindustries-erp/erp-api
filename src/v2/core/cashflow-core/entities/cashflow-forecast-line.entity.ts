import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/** Dòng hàng của dự chi mua hàng (kind = PURCHASE). Bảng `cashflow_forecast_lines`. */
@Entity('cashflow_forecast_lines')
export class CashflowForecastLine {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'forecast_id' })
  forecastId: string;

  @Column({ type: 'integer', name: 'line_no' })
  lineNo: number;

  @Column({ type: 'varchar', length: 16, name: 'line_type', default: 'GOODS' })
  lineType: 'GOODS' | 'SERVICE';

  @Column({ type: 'varchar', length: 255, name: 'item_name' })
  itemName: string;

  /** Số lượng đề nghị. Kiểu string vì TypeORM trả numeric dạng chuỗi. */
  @Column({
    type: 'numeric',
    precision: 18,
    scale: 3,
    name: 'qty_requested',
    default: 0,
  })
  qtyRequested: string;

  /** Số lượng đã đặt PO. Luôn 0 <= qty_ordered <= qty_requested (CHECK ở DB). */
  @Column({
    type: 'numeric',
    precision: 18,
    scale: 3,
    name: 'qty_ordered',
    default: 0,
  })
  qtyOrdered: string;

  @Column({
    type: 'numeric',
    precision: 18,
    scale: 2,
    name: 'unit_price',
    default: 0,
  })
  unitPrice: string;

  @Column({
    type: 'numeric',
    precision: 18,
    scale: 2,
    name: 'amount',
    default: 0,
  })
  amount: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
