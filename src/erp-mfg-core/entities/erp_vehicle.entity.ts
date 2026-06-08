import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'erp_vehicles' })
export class ErpVehicle {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255, name: 'vin' })
  vin: string;

  @Column({ type: 'varchar', length: 255, name: 'frame_no' })
  frameNo: string;

  @Column({ type: 'varchar', length: 255, name: 'engine_no' })
  engineNo: string;

  @Column({ type: 'uuid', name: 'branch_id', nullable: true })
  branchId: string | null;

  @Column({ type: 'uuid', name: 'finished_good_item_id', nullable: true })
  finishedGoodItemId: string | null;

  @Column({ type: 'date', name: 'assembly_date', nullable: true })
  assemblyDate: string | null;

  @Column({ type: 'varchar', length: 50, name: 'status', default: 'ASSEMBLED' })
  status: string;

  @Column({ type: 'text', name: 'notes', nullable: true })
  notes: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
