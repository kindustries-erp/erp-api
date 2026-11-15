import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppConfigModule } from '@/app-config/app-config.module';
import { AuditCoreModule } from '@/audit-core/audit-core.module';
import { AuthModule } from '@/auth/auth.module';
import { CoreRefreshToken } from '@/auth/entities/core-refresh-token.entity';
import { RbacCoreModule } from '@/v2/core/rbac-core';
import { UsersManagementModule } from '../users-management/users-management.module';
import { AuthSessionsService } from './auth-sessions.service';
import { AuthSessionsController } from './controllers/auth-sessions.controller';
import { AuthSession } from './entities/auth-session.entity';
import { AuthSessionCleanupJob } from './jobs/auth-session-cleanup.job';
import { AuthLoginService } from './services/auth-login.service';
import { AuthProfileService } from './services/auth-profile.service';
import { SessionTokenService } from './services/session-token.service';
import { LegacyRefreshTokenExchange } from './services/legacy-refresh-token.exchange';

/**
 * Auth v2: HTTP `/api/v2/auth`, phiên đăng nhập trên `auth_sessions`, người dùng từ `users_management`.
 * Dùng chung JWT (secret, payload) với v1 qua `AuthModule` nên guard và RBAC không đổi.
 */
@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([AuthSession, CoreRefreshToken]),
    AuthModule,
    UsersManagementModule,
    AuditCoreModule,
    RbacCoreModule,
    AppConfigModule,
  ],
  controllers: [AuthSessionsController],
  providers: [
    AuthSessionsService,
    AuthLoginService,
    AuthProfileService,
    SessionTokenService,
    LegacyRefreshTokenExchange,
    AuthSessionCleanupJob,
  ],
})
export class AuthSessionsModule {}
