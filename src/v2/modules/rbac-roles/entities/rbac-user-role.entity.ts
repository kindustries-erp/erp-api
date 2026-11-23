import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type { RbacRole } from './rbac-role.entity';
import type { UsersManagement } from '@/v2/modules/users-management/entities/users-management.entity';

@Entity({ name: 'rbac_user_roles' })
@Index('UQ_rbac_user_roles_user_role', ['userId', 'roleId'], { unique: true })
export class RbacUserRole {
  @PrimaryGeneratedColumn('uuid', {
    primaryKeyConstraintName: 'PK_rbac_user_roles_id',
  })
  id: string;

  @Column({ type: 'uuid', name: 'user_id' })
  userId: string;

  @ManyToOne('UsersManagement', { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'user_id',
    foreignKeyConstraintName: 'FK_rbac_user_roles_user_id',
  })
  user: UsersManagement;

  @Column({ type: 'uuid', name: 'role_id' })
  roleId: string;

  @ManyToOne('RbacRole', (role: any) => role.userRoles, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'role_id',
    foreignKeyConstraintName: 'FK_rbac_user_roles_role_id',
  })
  role: RbacRole;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
