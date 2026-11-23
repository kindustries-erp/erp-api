import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { RbacRole } from './rbac-role.entity';

@Entity({ name: 'rbac_permissions' })
@Index(
  'UQ_rbac_permissions_role_resource_action',
  ['roleId', 'resource', 'action'],
  {
    unique: true,
  },
)
export class RbacPermission {
  @PrimaryGeneratedColumn('uuid', {
    primaryKeyConstraintName: 'PK_rbac_permissions_id',
  })
  id: string;

  @Column({ type: 'uuid', name: 'role_id' })
  roleId: string;

  @ManyToOne('RbacRole', (role: any) => role.permissions, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'role_id',
    foreignKeyConstraintName: 'FK_rbac_permissions_role_id',
  })
  role: RbacRole;

  @Column({ type: 'varchar', length: 128 })
  resource: string;

  @Column({ type: 'varchar', length: 64 })
  action: string;

  @Column({ type: 'jsonb', nullable: true })
  conditions: Record<string, any> | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
