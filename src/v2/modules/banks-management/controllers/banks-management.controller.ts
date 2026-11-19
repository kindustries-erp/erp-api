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
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import { BanksManagementFacade } from '../banks-management.facade';
import { BankManagementQueryDto } from '../dto/bank-management-query.dto';
import { ColumnOptionsQueryDto } from '../dto/column-options-query.dto';
import { CreateBankManagementDto } from '../dto/create-bank-management.dto';
import { UpdateBankManagementDto } from '../dto/update-bank-management.dto';

@ApiTags('banks-management')
@Controller('api/v2/banks-management')
export class BanksManagementController {
  constructor(private readonly facade: BanksManagementFacade) {}

  @ApiOperation({
    summary: 'Lấy ảnh logo ngân hàng (phục vụ nội bộ, có cache và CORS đầy đủ)',
  })
  @Get('logo/:code')
  async getBankLogo(
    @Param('code') code: string,
    @Res() res: Response,
  ): Promise<void> {
    const { buffer, contentType } = await this.facade.getLogoBuffer(code);
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.send(buffer);
  }

  // Đặt trước :id để column-options không bị hiểu thành id
  @ApiOperation({ summary: 'Gợi ý giá trị cột, áp dụng bộ lọc các cột khác' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('column-options')
  columnOptions(@Query() query: ColumnOptionsQueryDto) {
    return this.facade.findColumnOptions(query);
  }

  // Đặt trước :id để sync-vietqr không bị hiểu thành id
  @ApiOperation({
    summary: 'Đồng bộ danh sách ngân hàng và link logo từ VietQR API',
  })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('sync-vietqr')
  syncVietQr() {
    return this.facade.syncFromVietQr();
  }

  @ApiOperation({ summary: 'Danh sách ngân hàng (phân trang, lọc, sắp xếp)' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get()
  findAll(@Query() query: BankManagementQueryDto) {
    return this.facade.findAll(query);
  }

  @ApiOperation({ summary: 'Chi tiết một ngân hàng' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.facade.findById(id);
  }

  @ApiOperation({ summary: 'Thêm mới ngân hàng thủ công' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post()
  create(@Body() dto: CreateBankManagementDto) {
    return this.facade.create(dto);
  }

  @ApiOperation({ summary: 'Cập nhật thông tin ngân hàng' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateBankManagementDto,
  ) {
    return this.facade.update(id, dto);
  }

  @ApiOperation({ summary: 'Xóa mềm ngân hàng' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.facade.remove(id);
  }
}
