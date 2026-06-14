import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';
import type { Request } from 'express';
import { AuthService } from './auth.service';
import { RegisterLocalUserDto } from './dto/register-local-user.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import { ChangePasswordSelfDto } from '../users-admin/dto/user-admin.dto';

class LoginDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;
}

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @ApiOperation({ summary: 'ERP Core local login' })
  @ApiBody({ type: LoginDto })
  login(@Body() body: LoginDto) {
    return this.authService.login(body.email, body.password);
  }

  @Post('register')
  @ApiOperation({
    summary: 'Tạo local ERP core user và optionally link employee',
  })
  @ApiBody({ type: RegisterLocalUserDto })
  register(@Body() body: RegisterLocalUserDto) {
    return this.authService.registerLocalUser(body);
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

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Profile của user local auth hiện tại' })
  profile(@Req() request: Request & { user: { sub: string } }) {
    return this.authService.profile(request.user.sub);
  }
}
