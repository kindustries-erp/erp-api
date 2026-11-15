import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import { CoreRbacGuard } from '@/auth/guards/core-rbac.guard';
import { RequirePermissions } from '@/auth/decorators/require-permissions.decorator';
import { ErpAction, ErpResource } from '@/v2/core/rbac-core';
import { AiHubGatewayService } from '../ai-hub-gateway.service';
import { QueryAiHubUsageLogDto } from '../dto/query-ai-hub-usage-log.dto';

const READ = { resource: ErpResource.AI_HUB_GATEWAY, action: ErpAction.READ };

/** Chỉ đọc: usage log do gateway tự ghi, không có API tạo/sửa/xóa. */
@ApiTags('ai-hub-gateway')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, CoreRbacGuard)
@Controller('api/v2/ai-hub-gateway')
export class AiHubUsageLogController {
  constructor(private readonly service: AiHubGatewayService) {}

  @RequirePermissions(READ)
  @ApiOperation({ summary: 'Kiểm tra kết nối 9router và tier đã cấu hình' })
  @Get('health')
  health() {
    return this.service.health();
  }

  @RequirePermissions(READ)
  @ApiOperation({ summary: 'Danh sách usage log (phân trang, tìm kiếm)' })
  @Get('usage-logs')
  findAll(@Query() query: QueryAiHubUsageLogDto) {
    return this.service.findAll(query);
  }

  // Đặt trước `:id` để `column-options` không bị hiểu thành id
  @RequirePermissions(READ)
  @ApiOperation({
    summary: 'Gợi ý giá trị của một cột, áp dụng bộ lọc các cột khác',
  })
  @Get('usage-logs/column-options')
  columnOptions(
    @Query('column') column: string,
    @Query('search') search?: string,
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '20',
    @Query('filters') filters?: string,
  ) {
    return this.service.findColumnOptions(
      column,
      search,
      Math.max(1, parseInt(page, 10) || 1),
      Math.max(1, Math.min(200, parseInt(pageSize, 10) || 20)),
      filters,
    );
  }

  @RequirePermissions(READ)
  @ApiOperation({ summary: 'Chi tiết một usage log' })
  @Get('usage-logs/:id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findOne(id);
  }
}
