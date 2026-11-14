import {
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import { NotificationParamsDto } from '../dto/notification-params.dto';
import { QueryNotificationDto } from '../dto/query-notification.dto';
import { NotificationsInboxService } from '../notifications-inbox.service';

/**
 * Thông báo của user đang đăng nhập. Không có RBAC: quyền là "xem thông báo của chính mình".
 * Route tĩnh (`all`, `read-all`, `unread-count`) khai báo trước route `:id`.
 */
@ApiTags('notifications_v2')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api/v2/notifications-inbox')
export class NotificationController {
  constructor(private readonly service: NotificationsInboxService) {}

  @Get()
  @ApiOperation({ summary: 'Danh sách thông báo của tôi (phân trang, lọc)' })
  list(
    @Req() req: Request & { user: { sub: string } },
    @Query() query: QueryNotificationDto,
  ) {
    return this.service.list(req.user.sub, query);
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Số thông báo chưa đọc của tôi' })
  unreadCount(@Req() req: Request & { user: { sub: string } }) {
    return this.service.unreadCount(req.user.sub);
  }

  @Patch('read-all')
  @ApiOperation({ summary: 'Đánh dấu tất cả đã đọc' })
  markAllRead(@Req() req: Request & { user: { sub: string } }) {
    return this.service.markAllRead(req.user.sub);
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Đánh dấu một thông báo đã đọc' })
  markRead(
    @Req() req: Request & { user: { sub: string } },
    @Param() params: NotificationParamsDto,
  ) {
    return this.service.markRead(params.id, req.user.sub);
  }

  @Delete('all')
  @ApiOperation({ summary: 'Xóa mềm tất cả thông báo của tôi' })
  removeAll(@Req() req: Request & { user: { sub: string } }) {
    return this.service.removeAll(req.user.sub);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Xóa mềm một thông báo của tôi' })
  remove(
    @Req() req: Request & { user: { sub: string } },
    @Param() params: NotificationParamsDto,
  ) {
    return this.service.remove(params.id, req.user.sub);
  }
}
