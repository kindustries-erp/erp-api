import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Bảng trung tâm (Hub) theo dõi các đơn vị tồn kho có tính định danh.
 * Được dùng chung cho các tracking policy: SERIAL, VEHICLE, CUSTOM.
 *
 * - SERIAL:  serialNo chứa số serial của sản phẩm; vinId = null; customId = null
 * - VEHICLE: serialNo chứa engineNo (dùng như key); vinId trỏ tới erp_vehicles; customId = null
 * - CUSTOM:  serialNo chứa mã định danh thủ công; vinId = null; customId trỏ tới erp_inventory_tracking_customs
 */
@Entity({ name: 'erp_inventory_tracking_serials' })
export class ErpInventoryTrackingSerial {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'item_id', nullable: true })
  itemId: string | null;

  @Column({ type: 'varchar', length: 255, name: 'serial_no' })
  serialNo: string;

  @Column({
    type: 'varchar',
    length: 50,
    name: 'status',
    default: 'IN_STOCK',
  })
  status: string;

  /** FK → erp_vehicles.id (dùng cho policy VEHICLE) */
  @Column({ type: 'uuid', name: 'vin_id', nullable: true })
  vinId: string | null;

  /** FK → erp_inventory_tracking_customs.id (dùng cho policy CUSTOM) */
  @Column({ type: 'uuid', name: 'custom_id', nullable: true })
  customId: string | null;

  @Column({ type: 'uuid', name: 'receipt_line_id', nullable: true })
  receiptLineId: string | null;

  @Column({ type: 'uuid', name: 'sales_order_line_id', nullable: true })
  salesOrderLineId: string | null;

  @Column({ type: 'uuid', name: 'goods_issue_line_id', nullable: true })
  goodsIssueLineId: string | null;

  @Column({ type: 'uuid', name: 'production_order_id', nullable: true })
  productionOrderId: string | null;

  @Column({ type: 'varchar', length: 255, name: 'lot_no', nullable: true })
  lotNo: string | null;

  @Column({ type: 'text', name: 'notes', nullable: true })
  notes: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
