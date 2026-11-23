import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import type { RbacPermission } from './rbac-permission.entity';
import type { RbacUserRole } from './rbac-user-role.entity';

@Entity({ name: 'rbac_roles' })
@Unique('UQ_rbac_roles_name', ['name'])
export class RbacRole {
  @PrimaryGeneratedColumn('uuid', {
    primaryKeyConstraintName: 'PK_rbac_roles_id',
  })
  id: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'boolean', default: true, name: 'is_active' })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToMany('RbacPermission', (perm: any) => perm.role)
  permissions: RbacPermission[];

  @OneToMany('RbacUserRole', (userRole: any) => userRole.role)
  userRoles: RbacUserRole[];
}
