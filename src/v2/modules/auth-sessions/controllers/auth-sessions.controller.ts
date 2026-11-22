import {
  Body,
  Controller,
  Get,
  HttpCode,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import { AuthSessionsService } from '../auth-sessions.service';
import { ChangePasswordDto } from '../dto/change-password.dto';
import { ImpersonateDto } from '../dto/impersonate.dto';
import { LoginDto } from '../dto/login.dto';
import { RefreshTokenDto } from '../dto/refresh-token.dto';
import { UpdateProfileDto } from '../dto/update-profile.dto';
import { clientMeta, requestMeta } from '../helpers/request-meta';
import type { AuthRequest } from '../helpers/request-meta';

/**
 * Công khai có chủ ý: `login`, `refresh`, `logout` (người gọi chưa có access token hợp lệ; refresh token là bằng chứng).
 * Mọi endpoint còn lại bắt buộc `JwtAuthGuard`. Chưa có giới hạn tần suất đăng nhập (xem security-baseline mục 3).
 */
@ApiTags('auth-sessions')
@Controller('api/v2/auth-sessions')
export class AuthSessionsController {
  constructor(private readonly service: AuthSessionsService) {}

  @ApiOperation({ summary: 'Đăng nhập' })
  @HttpCode(200)
  @Post('login')
  login(@Body() dto: LoginDto, @Req() req: Request) {
    return this.service.login(dto.email, dto.password, clientMeta(req));
  }

  @ApiOperation({ summary: 'Làm mới phiên bằng refresh token (xoay vòng)' })
  @HttpCode(200)
  @Post('refresh')
  refresh(@Body() dto: RefreshTokenDto) {
    return this.service.refresh(dto.refreshToken);
  }

  @ApiOperation({ summary: 'Đăng xuất, thu hồi refresh token' })
  @HttpCode(200)
  @Post('logout')
  logout(@Body() dto: RefreshTokenDto) {
    return this.service.logout(dto.refreshToken);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Đăng nhập thay người dùng (chỉ admin)' })
  @HttpCode(200)
  @Post('impersonate')
  impersonate(@Body() dto: ImpersonateDto, @Req() req: AuthRequest) {
    return this.service.impersonate(
      req.user.sub,
      dto.targetUserId,
      clientMeta(req),
    );
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Đổi mật khẩu của chính mình' })
  @HttpCode(200)
  @Post('change-password')
  changePassword(@Body() dto: ChangePasswordDto, @Req() req: AuthRequest) {
    return this.service.changePassword(req.user.sub, dto, requestMeta(req));
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Hồ sơ, quyền và tùy chọn của người dùng hiện tại' })
  @Get('profile')
  profile(@Req() req: AuthRequest) {
    return this.service.profile(req.user.sub);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Cập nhật hồ sơ cá nhân' })
  @Patch('profile')
  updateProfile(@Body() dto: UpdateProfileDto, @Req() req: AuthRequest) {
    return this.service.updateProfile(req.user.sub, dto);
  }
}
