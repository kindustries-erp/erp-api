import { Entity, Index } from 'typeorm';
import { BaseTablePreferenceEntity } from '@/v2/core/table-preferences-core';

/** Cấu hình V2 của một bảng dữ liệu cho một user: cột hiển thị và chế độ xem */
@Entity({ name: 'table_preferences' })
@Index('UQ_table_preferences_user_table', ['userId', 'tableId'], {
  unique: true,
})
export class CoreUserTablePreference extends BaseTablePreferenceEntity {}
