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
import { SalesOrdersCoreService } from './sales-orders-core.service';
import { CreateSalesOrderDto } from './dto/create-sales-order.dto';
import { UpdateSalesOrderDto } from './dto/update-sales-order.dto';
import { ReserveSalesOrderDto } from './dto/reserve-sales-order.dto';
import { UnreserveSalesOrderDto } from './dto/unreserve-sales-order.dto';

@ApiTags('erp_sales_orders')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('sales-orders')
export class SalesOrdersCoreController {
  constructor(private readonly service: SalesOrdersCoreService) {}

  @Post()
  create(@Body() dto: CreateSalesOrderDto) {
    return this.service.create(dto);
  }

  @Get()
  findAll(@Query() query: PaginationDto) {
    return this.service.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateSalesOrderDto,
  ) {
    return this.service.update(id, dto);
  }

  @Post(':id/reserve')
  reserve(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: ReserveSalesOrderDto,
  ) {
    return this.service.reserve(id, dto);
  }

  @Post(':id/unreserve')
  unreserve(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UnreserveSalesOrderDto,
  ) {
    return this.service.unreserve(id, dto);
  }
}
