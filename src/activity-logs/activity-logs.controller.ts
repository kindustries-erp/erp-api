import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { UserToken } from '../common/decorators/user-token.decorator';
import { ActivityLogsService } from './activity-logs.service';
import { DirectusAuthGuard } from '../auth/guards/directus-auth.guard';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
} from '@nestjs/swagger';

@ApiTags('Activity Logs')
@ApiBearerAuth()
@Controller('activity-logs')
@UseGuards(DirectusAuthGuard)
export class ActivityLogsController {
  constructor(private readonly activityLogsService: ActivityLogsService) {}

  @Get()
  @ApiOperation({
    summary: 'Lấy danh sách log kỹ thuật từ Directus (directus_activity)',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Giới hạn số lượng log trả về',
  })
  @ApiQuery({
    name: 'sort',
    required: false,
    type: String,
    description: 'Sắp xếp, ví dụ: -timestamp',
  })
  findAll(@Query() query: any, @UserToken() token: string) {
    return this.activityLogsService.findAll(query, token);
  }
}
