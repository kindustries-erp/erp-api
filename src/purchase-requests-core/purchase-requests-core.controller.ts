import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CoreRbacGuard } from '../auth/guards/core-rbac.guard';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { ErpResource, ErpAction } from '@/rbac-core/enums';
import { PaginationDto } from '../common/dto/pagination.dto';
import { PurchaseRequestsCoreService } from './purchase-requests-core.service';
import { CreatePurchaseRequestDto } from './dto/create-purchase-request.dto';
import { UpdatePurchaseRequestDto } from './dto/update-purchase-request.dto';

@ApiTags('erp_purchase_requests')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, CoreRbacGuard)
@Controller('purchase-requests')
export class PurchaseRequestsCoreController {
  constructor(private readonly service: PurchaseRequestsCoreService) {}

  @RequirePermissions({
    resource: ErpResource.PURCHASE_REQUESTS,
    action: ErpAction.CREATE,
  })
  @Post()
  create(@Body() dto: CreatePurchaseRequestDto) {
    return this.service.create(dto);
  }

  @RequirePermissions({
    resource: ErpResource.PURCHASE_REQUESTS,
    action: ErpAction.READ,
  })
  @Get()
  findAll(@Query() query: PaginationDto) {
    return this.service.findAll(query);
  }

  @RequirePermissions({
    resource: ErpResource.PURCHASE_REQUESTS,
    action: ErpAction.READ,
  })
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @RequirePermissions({
    resource: ErpResource.PURCHASE_REQUESTS,
    action: ErpAction.UPDATE,
  })
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdatePurchaseRequestDto) {
    return this.service.update(id, dto);
  }

  @RequirePermissions({
    resource: ErpResource.PURCHASE_REQUESTS,
    action: ErpAction.DELETE,
  })
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }

  @RequirePermissions({
    resource: ErpResource.PURCHASE_REQUESTS,
    action: ErpAction.UPDATE,
  })
  @Post(':id/cancel')
  cancel(@Param('id') id: string) {
    return this.service.cancel(id);
  }
}
