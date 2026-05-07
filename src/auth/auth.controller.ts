import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
  Request,
  Param,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ImpersonateDto } from './dto/impersonate.dto';
import { DirectusAuthGuard } from './guards/directus-auth.guard';
import { ApiBearerAuth } from '@nestjs/swagger';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * POST /api/v1/auth/register
   * Body: { email, password, first_name, last_name }
   * → Tạo user trên Directus (admin token), tự login → trả Directus tokens.
   */
  @Post('register')
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  /**
   * POST /api/v1/auth/login
   * Body: { email, password }
   * → Proxy đến Directus POST /auth/login → trả { access_token, refresh_token, expires }.
   */
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  /**
   * POST /api/v1/auth/refresh
   * Body: { refresh_token }
   * → Proxy đến Directus POST /auth/refresh → trả access_token mới.
   */
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refresh(dto.refresh_token);
  }

  /**
   * POST /api/v1/auth/logout
   * Body: { refresh_token }
   * → Proxy đến Directus POST /auth/logout → vô hiệu hóa refresh_token.
   */
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Body() dto: RefreshTokenDto) {
    return this.authService.logout(dto.refresh_token);
  }

  /**
   * GET /api/v1/auth/profile
   * Yêu cầu: Bearer Token
   * → Trả về profile, role, rolePermissions, customPermissions, effectivePermissions.
   */
  @Get('profile')
  @UseGuards(DirectusAuthGuard)
  @ApiBearerAuth()
  async getProfile(@Request() req: any) {
    return this.authService.getProfile(req.user);
  }

  /**
   * PATCH /api/v1/auth/profile
   * Body: { full_name?, phone?, notes? }
   * Yêu cầu: Bearer Token
   * → User tự cập nhật thông tin cá nhân (whitelist cứng, không sửa được field nhạy cảm).
   */
  @Patch('profile')
  @UseGuards(DirectusAuthGuard)
  @ApiBearerAuth()
  async updateProfile(@Request() req: any, @Body() dto: UpdateProfileDto) {
    return this.authService.updateProfile(req.user.id, dto);
  }

  /**
   * POST /api/v1/auth/change-password
   * Body: { new_password }
   * Yêu cầu: Bearer Token
   * → Đổi mật khẩu của user đang đăng nhập.
   */
  @Post('change-password')
  @UseGuards(DirectusAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  async changePassword(@Request() req: any, @Body() dto: ChangePasswordDto) {
    return this.authService.changePassword(req.user.id, dto);
  }

  /**
   * POST /api/v1/auth/impersonate
   * Yêu cầu: Bearer Token + có full CRUD trên directus_roles
   * Body: { target_user_id: "uuid" }
   * → Trả impersonation_token (JWT 8h). Dùng token này làm Bearer để gọi API như target user.
   * → Để quay về, frontend dùng lại refresh_token gốc → POST /auth/refresh.
   */
  @Post('impersonate')
  @UseGuards(DirectusAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  async impersonate(@Request() req: any, @Body() dto: ImpersonateDto) {
    return this.authService.impersonate(req.user, dto.target_user_id);
  }
}
