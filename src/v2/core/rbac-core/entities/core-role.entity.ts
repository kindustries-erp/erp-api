import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import type { CorePermission } from './core-permission.entity';
import type { CoreUserRole } from './core-user-role.entity';

@Entity({ name: 'core_roles' })
export class CoreRole {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'boolean', default: true, name: 'is_active' })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToMany('CorePermission', (perm: any) => perm.role)
  permissions: CorePermission[];

  @OneToMany('CoreUserRole', (userRole: any) => userRole.role)
  userRoles: CoreUserRole[];
}
