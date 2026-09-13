import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ErpBomLine } from '../../bom-core/entities/erp_bom_line.entity';
import { ErpInventoryTrackingSerial } from '../../inventory-core/entities/erp_inventory_tracking_serial.entity';
import { ErpProductionCheckpoint } from './erp_production_checkpoint.entity';

/**
 * Bảng As-Built BOM: lưu mối quan hệ Serial linh kiện → Xe thành phẩm.
 *
 * Được tạo khi hoàn thành sản xuất theo 2 cơ chế:
 *  - AUTO_FIFO:   Hệ thống tự động gán serial linh kiện theo thứ tự FIFO (giai đoạn 1)
 *  - MANUAL_SCAN: Công nhân scan barcode linh kiện tại trạm (giai đoạn 2)
 *  - QR_SCAN:     Quét QR code tại trạm qua camera (giai đoạn 2)
 *
 * Ràng buộc quan trọng:
 *  - serial_id là UNIQUE: 1 serial chỉ được gán vào 1 xe duy nhất
 *  - Không set vin_id trên erp_inventory_tracking_serials (policy=SERIAL);
 *    mối quan hệ linh kiện→xe sống hoàn toàn trong bảng này
 */
@Entity({ name: 'erp_production_order_serial_assignments' })
export class ErpProductionOrderSerialAssignment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** FK → erp_production_orders.id */
  @Index('idx_po_serial_asgn_production_order')
  @Column({ type: 'uuid', name: 'production_order_id' })
  productionOrderId: string;

  /** FK → erp_vehicles.id (xe được gán linh kiện) */
  @Index('idx_po_serial_asgn_vehicle')
  @Column({ type: 'uuid', name: 'vehicle_id' })
  vehicleId: string;

  /** FK → erp_bom_lines.id — null nếu gán thủ công không qua BOM */
  @Column({ type: 'uuid', name: 'bom_line_id', nullable: true })
  bomLineId: string | null;

  /** FK → erp_inventory_tracking_serials.id — UNIQUE: 1 serial chỉ được gán 1 xe */
  @Index('idx_po_serial_asgn_serial', { unique: true })
  @Column({ type: 'uuid', name: 'serial_id' })
  serialId: string;

  @Column({ type: 'timestamptz', name: 'assigned_at' })
  assignedAt: Date;

  /**
   * Nguồn gán serial:
   *  - AUTO_FIFO:   Hệ thống tự gán theo FIFO (giai đoạn 1)
   *  - MANUAL_SCAN: Nhân viên scan barcode thủ công (giai đoạn 2)
   *  - QR_SCAN:     Scan QR code tại trạm (giai đoạn 2)
   */
  @Column({
    type: 'varchar',
    length: 50,
    name: 'assignment_source',
    default: 'AUTO_FIFO',
  })
  assignmentSource: string;

  /** FK → erp_production_checkpoints.id — null ở giai đoạn 1 */
  @Column({ type: 'uuid', name: 'checkpoint_id', nullable: true })
  checkpointId: string | null;

  /** FK → users.id — null ở giai đoạn 1, dùng khi có Shop Floor UI */
  @Column({ type: 'uuid', name: 'worker_id', nullable: true })
  workerId: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  // --- Relations ---

  @ManyToOne(() => ErpBomLine, { createForeignKeyConstraints: false })
  @JoinColumn({ name: 'bom_line_id' })
  bomLine: ErpBomLine;

  @ManyToOne(() => ErpInventoryTrackingSerial, {
    createForeignKeyConstraints: false,
  })
  @JoinColumn({ name: 'serial_id' })
  serial: ErpInventoryTrackingSerial;

  @ManyToOne(() => ErpProductionCheckpoint, {
    createForeignKeyConstraints: false,
  })
  @JoinColumn({ name: 'checkpoint_id' })
  checkpoint: ErpProductionCheckpoint;
}
