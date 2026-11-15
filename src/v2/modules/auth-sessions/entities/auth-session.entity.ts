import { Entity, Index } from 'typeorm';
import { BaseAuthSessionEntity } from '@/v2/core/auth-core';

/**
 * Phiên đăng nhập v2 (refresh token). Chỉ lưu hash SHA-256 của token.
 * FK `user_id` -> `users_management(id)` ON DELETE CASCADE khai báo ở migration.
 */
@Entity({ name: 'auth_sessions' })
@Index('UQ_auth_sessions_token_hash', ['tokenHash'], { unique: true })
@Index('IDX_auth_sessions_user_id', ['userId'])
@Index('IDX_auth_sessions_expires_at', ['expiresAt'])
export class AuthSession extends BaseAuthSessionEntity {}
