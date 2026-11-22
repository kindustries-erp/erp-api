import { Column } from 'typeorm';
import { CoreSoftDeletableEntity } from '@/v2/core/base-core';

/**
 * Cột chung của danh mục ngân hàng toàn hệ thống.
 * Lõi chỉ giữ abstract base class: không chứa decorator @Entity, không có bảng DB riêng.
 * Bảng cụ thể (`banks_management`) thuộc về module con `banks-management`.
 * Kế thừa chuỗi base-core: id (UUID), extra_data (JSONB), created_at/updated_at (timestamptz), is_deleted (boolean, index).
 */
export abstract class BaseBankEntity extends CoreSoftDeletableEntity {
  @Column({ type: 'varchar', length: 50, name: 'code' })
  code: string;

  @Column({ type: 'varchar', length: 100, name: 'short_name' })
  shortName: string;

  @Column({ type: 'varchar', length: 255, name: 'name' })
  name: string;

  @Column({ type: 'varchar', length: 10, name: 'bin' })
  bin: string;

  @Column({ type: 'varchar', length: 500, name: 'logo_url', nullable: true })
  logoUrl?: string | null;

  @Column({ type: 'jsonb', name: 'aliases', default: '[]' })
  aliases: string[];

  @Column({ type: 'boolean', name: 'is_active', default: true })
  isActive: boolean;

  @Column({ type: 'boolean', name: 'transfer_supported', default: true })
  transferSupported: boolean;

  @Column({ type: 'boolean', name: 'lookup_supported', default: true })
  lookupSupported: boolean;

  @Column({ type: 'timestamptz', name: 'synced_at', nullable: true })
  syncedAt?: Date | null;
}
