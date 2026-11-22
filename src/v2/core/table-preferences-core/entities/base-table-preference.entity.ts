import { Column } from 'typeorm';
import { CoreSoftDeletableEntity } from '@/v2/core/base-core';

/**
 * Cột của cấu hình bảng dữ liệu theo user: cột hiển thị và chế độ xem.
 * Lõi chỉ khai báo cột. Module cụ thể thêm `@Entity`, `@Index` và tên bảng.
 */
export abstract class BaseTablePreferenceEntity extends CoreSoftDeletableEntity {
  @Column({ type: 'uuid', name: 'user_id' })
  userId: string;

  @Column({ type: 'varchar', length: 200, name: 'table_id' })
  tableId: string;

  @Column({ type: 'jsonb', default: {} })
  columns: Record<string, any>;

  @Column({ type: 'jsonb', default: {} })
  views: Record<string, any>;
}
