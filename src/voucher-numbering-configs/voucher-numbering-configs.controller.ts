import { UserToken } from '../common/decorators/user-token.decorator';
import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { DirectusAuthGuard } from '../auth/guards/directus-auth.guard';
import { PaginationDto } from '../common/dto/pagination.dto';
import { VoucherNumberingConfigsService } from './voucher-numbering-configs.service';
import { CreateVoucherNumberingConfigsDto } from './dto/create-voucher-numbering-configs.dto';
import { UpdateVoucherNumberingConfigsDto } from './dto/update-voucher-numbering-configs.dto';

@ApiTags('VoucherNumberingConfigs')
@ApiBearerAuth()
@Controller('voucher-numbering-configs')
@UseGuards(DirectusAuthGuard)
export class VoucherNumberingConfigsController {
  constructor(
    private readonly voucherNumberingConfigsService: VoucherNumberingConfigsService,
  ) {}

  @Post()
  create(
    @Body() dto: CreateVoucherNumberingConfigsDto,
    @UserToken() token: string,
  ) {
    return this.voucherNumberingConfigsService.create(dto, token);
  }

  @Get()
  findAll(@Query() query: PaginationDto, @UserToken() token: string) {
    return this.voucherNumberingConfigsService.findAll(query, token);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @UserToken() token: string) {
    return this.voucherNumberingConfigsService.findOne(id, token);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateVoucherNumberingConfigsDto,
    @UserToken() token: string,
  ) {
    return this.voucherNumberingConfigsService.update(id, dto, token);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @UserToken() token: string) {
    return this.voucherNumberingConfigsService.remove(id, token);
  }
}
