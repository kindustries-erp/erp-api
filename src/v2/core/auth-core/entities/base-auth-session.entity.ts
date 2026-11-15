import { Column } from 'typeorm';
import { CoreSoftDeletableEntity } from '@/v2/core/base-core';

/**
 * Cột chung của một phiên đăng nhập (refresh token). Lớp con khai báo `@Entity`, tên bảng, index
 * (unique `token_hash`, index `user_id`) và khóa ngoại tới bảng người dùng.
 * Chỉ lưu hash của token. Mọi cột thời gian dùng `timestamptz`.
 */
export abstract class BaseAuthSessionEntity extends CoreSoftDeletableEntity {
  @Column({ type: 'uuid', name: 'user_id' })
  userId: string;

  /** SHA-256 (hex) của refresh token thô. */
  @Column({ type: 'varchar', length: 255, name: 'token_hash' })
  tokenHash: string;

  @Column({ type: 'timestamptz', name: 'expires_at' })
  expiresAt: Date;

  /** Có giá trị nghĩa là phiên đã bị thu hồi (xoay vòng, đăng xuất, đổi mật khẩu, ngưng tài khoản). */
  @Column({ type: 'timestamptz', name: 'revoked_at', nullable: true })
  revokedAt: Date | null;

  @Column({ type: 'varchar', length: 500, name: 'user_agent', nullable: true })
  userAgent: string | null;

  @Column({ type: 'varchar', length: 100, name: 'ip_address', nullable: true })
  ipAddress: string | null;
}
