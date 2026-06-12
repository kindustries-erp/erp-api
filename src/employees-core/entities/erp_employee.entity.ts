import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'erp_employees' })
export class ErpEmployee {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 255, name: 'employee_code' })
  employeeCode: string;

  @Column({ type: 'varchar', length: 255, name: 'full_name' })
  fullName: string;

  @Column({ type: 'varchar', length: 255, name: 'email', nullable: true })
  email: string | null;

  @Column({ type: 'varchar', length: 255, name: 'phone', nullable: true })
  phone: string | null;

  @Column({ type: 'varchar', length: 255, name: 'status', default: 'ACTIVE' })
  status: string;

  @Column({ type: 'uuid', name: 'user_id', nullable: true })
  userId: string | null;

  @Column({ type: 'text', name: 'address', nullable: true })
  address: string | null;

  @Column({ type: 'date', name: 'start_date', nullable: true })
  startDate: string | null;

  @Column({ type: 'date', name: 'leave_date', nullable: true })
  leaveDate: string | null;

  @Column({ type: 'text', name: 'notes', nullable: true })
  notes: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
