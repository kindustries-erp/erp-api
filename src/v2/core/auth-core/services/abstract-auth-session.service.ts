import { IsNull, LessThan } from 'typeorm';
import type { DeepPartial, FindOptionsWhere, Repository } from 'typeorm';
import { REFRESH_TOKEN_LIFETIME_SECONDS } from '../constants/auth.constants';
import type { BaseAuthSessionEntity } from '../entities/base-auth-session.entity';
import { generateRefreshToken, hashToken } from '../helpers/token.helper';
import type { AuthClientMeta } from '../types/auth-token.types';

export interface RotatedSession<T> {
  /** Phiên cũ vừa bị thu hồi. */
  previous: T;
  /** Refresh token thô mới (chỉ trả đúng một lần). */
  refreshToken: string;
}

/**
 * Vòng đời phiên đăng nhập: phát hành, xoay vòng, thu hồi, phát hiện dùng lại token đã thu hồi.
 * Lớp con cung cấp `Repository` của entity cụ thể. Không có `@Injectable`/`@Entity` ở lõi.
 */
export abstract class AbstractAuthSessionService<
  T extends BaseAuthSessionEntity,
> {
  protected constructor(protected readonly sessions: Repository<T>) {}

  /** Tạo phiên mới, trả refresh token thô. */
  async issue(userId: string, meta: AuthClientMeta = {}): Promise<string> {
    const raw = generateRefreshToken();
    await this.sessions.save(
      this.sessions.create({
        userId,
        tokenHash: hashToken(raw),
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_LIFETIME_SECONDS * 1000),
        revokedAt: null,
        userAgent: meta.userAgent ?? null,
        ipAddress: meta.ipAddress ?? null,
        isDeleted: false,
        extraData: {},
      } as unknown as DeepPartial<T>),
    );
    return raw;
  }

  /**
   * Phiên hợp lệ ứng với token thô, hoặc null. Token đã bị thu hồi mà còn được gửi lên là dấu hiệu bị đánh cắp:
   * thu hồi mọi phiên của người dùng đó.
   */
  async findValid(raw: string): Promise<T | null> {
    const record = await this.sessions.findOne({
      where: {
        tokenHash: hashToken(raw),
        isDeleted: false,
      } as FindOptionsWhere<T>,
    });
    if (!record) return null;
    if (record.revokedAt !== null) {
      await this.revokeAllForUser(record.userId);
      return null;
    }
    if (record.expiresAt < new Date()) return null;
    return record;
  }

  /**
   * Thu hồi phiên cũ và phát hành phiên mới. Thu hồi có điều kiện `revoked_at IS NULL` nên hai request
   * đồng thời với cùng một token chỉ một request thắng; request thua nhận null (401), không thu hồi hàng loạt.
   */
  async rotate(raw: string): Promise<RotatedSession<T> | null> {
    const previous = await this.findValid(raw);
    if (!previous) return null;
    const result = await this.sessions.update(
      { id: previous.id, revokedAt: IsNull() } as FindOptionsWhere<T>,
      { revokedAt: new Date() } as never,
    );
    if (!result.affected) return null;
    const refreshToken = await this.issue(previous.userId, {
      userAgent: previous.userAgent ?? undefined,
      ipAddress: previous.ipAddress ?? undefined,
    });
    return { previous, refreshToken };
  }

  async revoke(raw: string): Promise<void> {
    await this.sessions.update(
      { tokenHash: hashToken(raw), revokedAt: IsNull() } as FindOptionsWhere<T>,
      { revokedAt: new Date() } as never,
    );
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await this.sessions.update(
      { userId, revokedAt: IsNull() } as FindOptionsWhere<T>,
      { revokedAt: new Date() } as never,
    );
  }

  /** Xóa cứng phiên đã hết hạn trước `cutoff`. Trả số dòng đã xóa. */
  async purgeExpiredBefore(cutoff: Date): Promise<number> {
    const result = await this.sessions.delete({
      expiresAt: LessThan(cutoff),
    } as FindOptionsWhere<T>);
    return result.affected ?? 0;
  }
}
