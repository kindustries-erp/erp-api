import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterLocalUserDto } from './dto/register-local-user.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import { ChangePasswordSelfDto } from '../users-admin/dto/user-admin.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @ApiOperation({ summary: 'ERP Core local login' })
  @ApiBody({ type: LoginDto })
  login(@Body() body: LoginDto, @Req() req: Request) {
    return this.authService.login(body.email, body.password, {
      userAgent: req.headers['user-agent'] ?? undefined,
      ipAddress: req.ip ?? undefined,
    });
  }

  @Post('register')
  @ApiOperation({
    summary: 'Tạo local ERP core user và optionally link employee',
  })
  @ApiBody({ type: RegisterLocalUserDto })
  register(@Body() body: RegisterLocalUserDto) {
    return this.authService.registerLocalUser(body);
  }

  @Post('refresh')
  @ApiOperation({ summary: 'Làm mới access token bằng refresh token' })
  @ApiBody({ type: RefreshTokenDto })
  refresh(@Body() body: RefreshTokenDto) {
    return this.authService.refresh(body.refresh_token);
  }

  @Post('logout')
  @ApiOperation({ summary: 'Đăng xuất và revoke refresh token' })
  @ApiBody({ type: RefreshTokenDto })
  logout(@Body() body: RefreshTokenDto) {
    return this.authService.logout(body.refresh_token);
  }

  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Đổi mật khẩu cho user đang đăng nhập' })
  changePassword(
    @Body() body: ChangePasswordSelfDto,
    @Req() request: Request & { user: { sub: string; email: string } },
  ) {
    return this.authService.changePassword(
      request.user.sub,
      body,
      request as any,
    );
  }

  @Post('impersonate')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Login as user (chỉ dành cho admin)' })
  impersonate(
    @Body() body: { targetUserId: string },
    @Req() request: Request & { user: { sub: string } },
  ) {
    return this.authService.impersonate(request.user.sub, body.targetUserId, {
      userAgent: request.headers['user-agent'] ?? undefined,
      ipAddress: request.ip ?? undefined,
    });
  }

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Profile của user local auth hiện tại' })
  profile(@Req() request: Request & { user: { sub: string } }) {
    return this.authService.profile(request.user.sub);
  }

  @Patch('profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cập nhật hồ sơ cá nhân của user hiện tại' })
  updateProfile(
    @Body() body: UpdateProfileDto,
    @Req() request: Request & { user: { sub: string } },
  ) {
    return this.authService.updateProfile(request.user.sub, body);
  }
}
