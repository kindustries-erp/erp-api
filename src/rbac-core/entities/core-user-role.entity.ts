import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type { CoreRole } from './core-role.entity';
import type { CoreUser } from '../../users/entities/core-user.entity';

@Entity({ name: 'core_user_roles' })
@Index(['userId', 'roleId'], { unique: true })
export class CoreUserRole {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'user_id' })
  userId: string;

  @ManyToOne('CoreUser', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: CoreUser;

  @Column({ type: 'uuid', name: 'role_id' })
  roleId: string;

  @ManyToOne('CoreRole', (role: any) => role.userRoles, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'role_id' })
  role: CoreRole;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
