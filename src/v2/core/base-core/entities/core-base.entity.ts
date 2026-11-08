import { Column, PrimaryGeneratedColumn } from 'typeorm';

/**
 * Lớp nền nhỏ nhất của mọi entity v2: khóa uuid và `extraData`.
 * `extra_data` là jsonb NOT NULL mặc định `{}`: chỗ bổ sung dữ liệu tùy biến
 * mà không cần migration mới. Ghi/merge qua `mergeExtraData`, kiểm tra qua `assertValidExtraData`.
 */
export abstract class CoreBaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'jsonb',
    name: 'extra_data',
    default: () => "'{}'",
  })
  extraData: Record<string, unknown>;
}
