import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CoreRbacGuard } from '../auth/guards/core-rbac.guard';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { PaginationDto } from '../common/dto/pagination.dto';
import { GoodsIssuesCoreService } from './goods-issues-core.service';
import { CreateGoodsIssueDto } from './dto/create-goods-issue.dto';
import { UpdateGoodsIssueDto } from './dto/update-goods-issue.dto';
import { PostGoodsIssueDto } from './dto/post-goods-issue.dto';

@ApiTags('erp_goods_issues')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, CoreRbacGuard)
@Controller('goods-issues')
export class GoodsIssuesCoreController {
  constructor(private readonly service: GoodsIssuesCoreService) {}

  @RequirePermissions({ resource: 'goods_issues', action: 'create' })
  @Post()
  create(@Body() dto: CreateGoodsIssueDto) {
    return this.service.create(dto);
  }

  @RequirePermissions({ resource: 'goods_issues', action: 'read' })
  @Get()
  findAll(@Query() query: PaginationDto) {
    return this.service.findAll(query);
  }

  @RequirePermissions({ resource: 'goods_issues', action: 'read' })
  @Get(':id')
  findOne(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.findOne(id);
  }

  @RequirePermissions({ resource: 'goods_issues', action: 'update' })
  @Patch(':id')
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateGoodsIssueDto,
  ) {
    return this.service.update(id, dto);
  }

  @RequirePermissions({ resource: 'goods_issues', action: 'update' })
  @Post(':id/post')
  postIssue(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: PostGoodsIssueDto,
  ) {
    return this.service.postIssue(id, dto);
  }

  @RequirePermissions({ resource: 'goods_issues', action: 'delete' })
  @Delete(':id')
  remove(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.remove(id);
  }
}
