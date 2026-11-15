import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AbstractAuthSessionService } from '@/v2/core/auth-core';
import { AuthSession } from '../entities/auth-session.entity';

/** Phiên đăng nhập v2 trên bảng `auth_sessions`. Toàn bộ logic vòng đời nằm ở lõi `auth-core`. */
@Injectable()
export class SessionTokenService extends AbstractAuthSessionService<AuthSession> {
  constructor(
    @InjectRepository(AuthSession) sessions: Repository<AuthSession>,
  ) {
    super(sessions);
  }
}
