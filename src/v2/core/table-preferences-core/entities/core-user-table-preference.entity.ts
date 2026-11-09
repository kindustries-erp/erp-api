import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/** Cấu hình V2 của một bảng dữ liệu cho một user: cột hiển thị và chế độ xem */
@Entity({ name: 'core_user_table_preferences' })
@Index(['userId', 'tableId'], { unique: true })
export class CoreUserTablePreference {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'user_id' })
  userId: string;

  @Column({ type: 'varchar', length: 200, name: 'table_id' })
  tableId: string;

  @Column({ type: 'jsonb', default: {} })
  columns: Record<string, any>;

  @Column({ type: 'jsonb', default: {} })
  views: Record<string, any>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
