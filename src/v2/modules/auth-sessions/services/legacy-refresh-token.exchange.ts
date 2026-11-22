import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { CoreRefreshToken } from '@/auth/entities/core-refresh-token.entity';
import { hashToken } from '@/v2/core/auth-core';

export interface ExchangedLegacySession {
  userId: string;
  userAgent: string | null;
  ipAddress: string | null;
}

/**
 * ADAPTER TẠM: đổi MỘT lần refresh token v1 (`core_refresh_tokens`) còn hiệu lực sang phiên v2,
 * để người dùng đang đăng nhập bằng v1 không bị văng khi web chuyển sang `/api/v2/auth`.
 * Xóa file này khi bỏ v1. Thu hồi có điều kiện `revoked_at IS NULL` nên hai request đồng thời chỉ một bên thắng.
 * Token v1 đã thu hồi hoặc hết hạn không được đổi (v1 vẫn tự xử lý phát hiện dùng lại token ở endpoint của nó).
 */
@Injectable()
export class LegacyRefreshTokenExchange {
  constructor(
    @InjectRepository(CoreRefreshToken)
    private readonly legacy: Repository<CoreRefreshToken>,
  ) {}

  async exchange(raw: string): Promise<ExchangedLegacySession | null> {
    const record = await this.legacy.findOne({
      where: { tokenHash: hashToken(raw) },
    });
    if (!record || record.revokedAt !== null) return null;
    if (record.expiresAt < new Date()) return null;
    const result = await this.legacy.update(
      { id: record.id, revokedAt: IsNull() },
      { revokedAt: new Date() },
    );
    if (!result.affected) return null;
    return {
      userId: record.userId,
      userAgent: record.userAgent,
      ipAddress: record.ipAddress,
    };
  }
}
