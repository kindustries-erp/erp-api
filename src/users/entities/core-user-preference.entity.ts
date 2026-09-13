import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'core_user_preferences' })
export class CoreUserPreference {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ type: 'uuid', name: 'user_id' })
  userId: string;

  @Column({ type: 'varchar', length: 50, default: 'classic' })
  theme: string;

  @Column({ type: 'varchar', length: 10, default: 'vi' })
  language: string;

  @Column({ type: 'jsonb', name: 'table_configs', default: {} })
  tableConfigs: Record<string, any>;

  @Column({ type: 'jsonb', name: 'ui_configs', default: {} })
  uiConfigs: Record<string, any>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
