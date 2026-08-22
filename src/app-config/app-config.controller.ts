import { Body, Controller, Get, Patch, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { AppConfigService } from './app-config.service';
import { UpdateUserPreferenceDto } from './dto/update-user-preference.dto';
import { QueryChangelogDto } from './dto/query-changelog.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('App Config & Preferences')
@Controller('app')
export class AppConfigController {
  constructor(private readonly appConfigService: AppConfigService) {}

  @Get('config')
  @ApiOperation({
    summary:
      'Lấy thông tin cấu hình môi trường công khai (APP_ENV, appName, version)',
  })
  getPublicConfig() {
    return this.appConfigService.getPublicConfig();
  }

  @Get('changelog')
  @ApiOperation({
    summary:
      'Lấy danh sách nhật ký phát hành (Changelog Timeline) có tìm kiếm và phân trang server-side',
  })
  getChangelog(@Query() query: QueryChangelogDto) {
    return this.appConfigService.getChangelog(query);
  }

  @Get('preferences')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Lấy cấu hình tùy chọn cá nhân của user đang đăng nhập',
  })
  async getUserPreferences(@Req() req: Request & { user: { sub: string } }) {
    const data = await this.appConfigService.getUserPreferences(req.user.sub);
    return {
      message: 'Lấy tùy chọn người dùng thành công',
      data,
    };
  }

  @Patch('preferences')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Cập nhật cấu hình tùy chọn cá nhân (theme, language, tableConfigs)',
  })
  async updateUserPreferences(
    @Body() dto: UpdateUserPreferenceDto,
    @Req() req: Request & { user: { sub: string } },
  ) {
    const data = await this.appConfigService.updateUserPreferences(
      req.user.sub,
      dto,
    );
    return {
      message: 'Cập nhật tùy chọn người dùng thành công',
      data,
    };
  }
}
