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
import { PaginationDto } from '../common/dto/pagination.dto';
import { PurchaseRequestsCoreService } from './purchase-requests-core.service';
import { CreatePurchaseRequestDto } from './dto/create-purchase-request.dto';
import { UpdatePurchaseRequestDto } from './dto/update-purchase-request.dto';

@ApiTags('erp_purchase_requests')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('purchase-requests')
export class PurchaseRequestsCoreController {
  constructor(private readonly service: PurchaseRequestsCoreService) {}

  @Post()
  create(@Body() dto: CreatePurchaseRequestDto) {
    return this.service.create(dto);
  }

  @Get()
  findAll(@Query() query: PaginationDto) {
    return this.service.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdatePurchaseRequestDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }

  @Post(':id/cancel')
  cancel(@Param('id') id: string) {
    return this.service.cancel(id);
  }
}
