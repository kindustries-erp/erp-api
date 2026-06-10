import {
  Body,
  Controller,
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
import { PaginationDto } from '../common/dto/pagination.dto';
import { GoodsReceiptsCoreService } from './goods-receipts-core.service';
import { CreateGoodsReceiptDto } from './dto/create-goods-receipt.dto';
import { UpdateGoodsReceiptDto } from './dto/update-goods-receipt.dto';
import { PostGoodsReceiptDto } from './dto/post-goods-receipt.dto';

@ApiTags('erp_goods_receipts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('goods-receipts')
export class GoodsReceiptsCoreController {
  constructor(private readonly service: GoodsReceiptsCoreService) {}

  @Post()
  create(@Body() dto: CreateGoodsReceiptDto) {
    return this.service.create(dto);
  }

  @Get()
  findAll(@Query() query: PaginationDto) {
    return this.service.findAll(query);
  }

  @Get('next-no')
  getNextNo(@Query('date') date?: string) {
    return this.service.getNextReceiptNo(date);
  }

  @Get(':id')
  findOne(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateGoodsReceiptDto,
  ) {
    return this.service.update(id, dto);
  }

  @Post(':id/post')
  postReceipt(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: PostGoodsReceiptDto,
  ) {
    return this.service.postReceipt(id, dto);
  }

  @Post(':id/cancel')
  cancelReceipt(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.cancelReceipt(id);
  }
}
