import { Controller, Get, UseGuards, Request } from '@nestjs/common';
import { AppService } from './app.service';
import { DirectusAuthGuard } from './auth/guards/directus-auth.guard';
import { ApiBearerAuth } from '@nestjs/swagger';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  // Route test để xem DirectusAuthGuard hoạt động
  @Get('me')
  @UseGuards(DirectusAuthGuard)
  @ApiBearerAuth()
  getProfile(@Request() req: any) {
    // req.user được gán từ DirectusAuthGuard sau khi gọi /users/me của Directus
    return {
      message: 'Token hợp lệ!',
      user: req.user,
    };
  }
}
