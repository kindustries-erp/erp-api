import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CoreRbacGuard } from '../auth/guards/core-rbac.guard';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { InventoryAdjustmentsCoreService } from './inventory-adjustments-core.service';
import { CreateInventoryAdjustmentDto } from './dto/create-inventory-adjustment.dto';
import { UpdateInventoryAdjustmentDto } from './dto/update-inventory-adjustment.dto';
import { PostInventoryAdjustmentDto } from './dto/post-inventory-adjustment.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
@ApiTags('inventory-adjustments-core')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, CoreRbacGuard)
@Controller('inventory-adjustments')
export class InventoryAdjustmentsCoreController {
  constructor(private readonly service: InventoryAdjustmentsCoreService) {}

  @RequirePermissions({ resource: 'inventory_adjustments', action: 'create' })
  @Post()
  @ApiOperation({ summary: 'Create new inventory adjustment' })
  create(@Body() dto: CreateInventoryAdjustmentDto) {
    return this.service.create(dto);
  }

  @RequirePermissions({ resource: 'inventory_adjustments', action: 'read' })
  @Get()
  @ApiOperation({ summary: 'List inventory adjustments' })
  findAll(@Query() query: PaginationDto) {
    return this.service.findAll(query);
  }

  @Get('next-no')
  @ApiOperation({ summary: 'Get next adjustment voucher number' })
  getNextNo(@Query('date') date?: string) {
    return this.service.getNextAdjustmentNo(date);
  }

  @RequirePermissions({ resource: 'inventory_adjustments', action: 'read' })
  @Get(':id')
  @ApiOperation({ summary: 'Get adjustment details' })
  findOne(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.findOne(id);
  }

  @RequirePermissions({ resource: 'inventory_adjustments', action: 'update' })
  @Patch(':id')
  @ApiOperation({ summary: 'Update adjustment' })
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateInventoryAdjustmentDto,
  ) {
    return this.service.update(id, dto);
  }

  @RequirePermissions({ resource: 'inventory_adjustments', action: 'update' })
  @Post(':id/post')
  @ApiOperation({ summary: 'Post adjustment to inventory' })
  postAdjustment(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: PostInventoryAdjustmentDto,
  ) {
    return this.service.postAdjustment(id, dto);
  }

  @RequirePermissions({ resource: 'inventory_adjustments', action: 'update' })
  @Post(':id/cancel')
  @ApiOperation({ summary: 'Cancel posted adjustment' })
  cancelAdjustment(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.cancelAdjustment(id);
  }

  @RequirePermissions({ resource: 'inventory_adjustments', action: 'delete' })
  @Delete(':id')
  @ApiOperation({ summary: 'Delete draft adjustment' })
  remove(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.remove(id);
  }
}
