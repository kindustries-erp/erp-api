import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Delete,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OperationalQueryDto } from '../operational-documents/dto/operational-document.dto';
import { PurchaseOrdersCoreService } from './purchase-orders-core.service';
import { CreatePurchaseOrderDto } from './dto/create-purchase-order.dto';
import { UpdatePurchaseOrderDto } from './dto/update-purchase-order.dto';

@ApiTags('erp_purchase_orders')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('purchase-orders')
export class PurchaseOrdersCoreController {
  constructor(private readonly service: PurchaseOrdersCoreService) {}

  @Post()
  create(@Body() dto: CreatePurchaseOrderDto) {
    return this.service.create(dto);
  }

  @Get()
  findAll(@Query() query: OperationalQueryDto) {
    return this.service.findAll(query);
  }

  @Get('next-no')
  getNextNo(@Query('date') date?: string) {
    return this.service.getNextPoNo(date);
  }

  @Get(':id/receipts')
  getReceipts(@Param('id') id: string) {
    return this.service.getReceiptTimeline(id);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdatePurchaseOrderDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
