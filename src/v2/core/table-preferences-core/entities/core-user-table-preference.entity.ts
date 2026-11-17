import { Column, Entity, Index } from 'typeorm';
import { CoreSoftDeletableEntity } from '@/v2/core/base-core';

/** Cấu hình V2 của một bảng dữ liệu cho một user: cột hiển thị và chế độ xem */
@Entity({ name: 'table_preferences' })
@Index('UQ_table_preferences_user_table', ['userId', 'tableId'], {
  unique: true,
})
export class CoreUserTablePreference extends CoreSoftDeletableEntity {
  @Column({ type: 'uuid', name: 'user_id' })
  userId: string;

  @Column({ type: 'varchar', length: 200, name: 'table_id' })
  tableId: string;

  @Column({ type: 'jsonb', default: {} })
  columns: Record<string, any>;

  @Column({ type: 'jsonb', default: {} })
  views: Record<string, any>;
}
