import { Injectable } from '@nestjs/common';
import type { AuthClientMeta } from '@/v2/core/auth-core';
import type { ChangePasswordDto } from './dto/change-password.dto';
import type { UpdateProfileDto } from './dto/update-profile.dto';
import { AuthLoginService } from './services/auth-login.service';
import { AuthProfileService } from './services/auth-profile.service';
import type { AuthRequestMeta } from './services/auth-profile.service';

/** Facade auth v2: điều phối login/profile, luôn trả `{ message, data }` camelCase. */
@Injectable()
export class AuthSessionsService {
  constructor(
    private readonly login_: AuthLoginService,
    private readonly profile_: AuthProfileService,
  ) {}

  async login(email: string, password: string, meta: AuthClientMeta) {
    return {
      message: 'Đăng nhập thành công',
      data: await this.login_.login(email, password, meta),
    };
  }

  async refresh(refreshToken: string) {
    return {
      message: 'Làm mới phiên đăng nhập thành công',
      data: await this.login_.refresh(refreshToken),
    };
  }

  async logout(refreshToken: string) {
    await this.login_.logout(refreshToken);
    return { message: 'Đăng xuất thành công' };
  }

  async impersonate(
    adminId: string,
    targetUserId: string,
    meta: AuthClientMeta,
  ) {
    return {
      message: 'Đăng nhập thay người dùng thành công',
      data: await this.login_.impersonate(adminId, targetUserId, meta),
    };
  }

  async profile(userId: string) {
    return { message: 'OK', data: await this.profile_.profile(userId) };
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    return {
      message: 'Cập nhật hồ sơ thành công',
      data: await this.profile_.updateProfile(userId, dto),
    };
  }

  async changePassword(
    userId: string,
    dto: ChangePasswordDto,
    meta: AuthRequestMeta,
  ) {
    await this.profile_.changePassword(
      userId,
      dto.oldPassword,
      dto.newPassword,
      meta,
    );
    return { message: 'Đổi mật khẩu thành công' };
  }
}
