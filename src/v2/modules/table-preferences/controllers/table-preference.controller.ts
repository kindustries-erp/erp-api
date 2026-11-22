import {
  Body,
  Controller,
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
import { TablePreferencesService } from '../table-preferences.service';
import { ListTablePreferencesDto } from '../dto/list-table-preferences.dto';
import { TablePreferenceParamsDto } from '../dto/table-preference-params.dto';
import { UpdateTablePreferenceDto } from '../dto/update-table-preference.dto';

@ApiTags('table_preferences_v2')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api/v2/table-preferences')
export class TablePreferenceController {
  constructor(private readonly service: TablePreferencesService) {}

  @Get()
  @ApiOperation({
    summary:
      'Danh sách cấu hình bảng của user đang đăng nhập (lọc theo tiền tố tùy chọn)',
  })
  list(
    @Req() req: Request & { user: { sub: string } },
    @Query() query: ListTablePreferencesDto,
  ) {
    return this.service.list(req.user.sub, query);
  }

  @Patch(':tableId')
  @ApiOperation({
    summary: 'Ghi đè từng phần columns/views của một bảng (upsert)',
  })
  update(
    @Req() req: Request & { user: { sub: string } },
    @Param() params: TablePreferenceParamsDto,
    @Body() body: UpdateTablePreferenceDto,
  ) {
    return this.service.update(req.user.sub, params.tableId, body);
  }
}
