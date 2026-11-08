import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  UpdateDateColumn,
} from 'typeorm';
import { CoreBaseEntity } from '../../base-core/entities/core-base.entity';

@Entity({ name: 'erp_branches' })
export class ErpBranch extends CoreBaseEntity {
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 100, name: 'code' })
  code: string;

  @Column({ type: 'varchar', length: 255, name: 'name' })
  name: string;

  @Column({ type: 'text', name: 'address', nullable: true })
  address: string | null;

  @Column({ type: 'boolean', name: 'is_active', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
