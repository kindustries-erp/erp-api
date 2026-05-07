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
import { CashFundsService } from './cash-funds.service';
import { CreateCashFundsDto } from './dto/create-cash-funds.dto';
import { UpdateCashFundsDto } from './dto/update-cash-funds.dto';

@ApiTags('CashFunds')
@ApiBearerAuth()
@Controller('cash-funds')
@UseGuards(DirectusAuthGuard)
export class CashFundsController {
  constructor(private readonly cashFundsService: CashFundsService) {}

  @Post()
  create(@Body() dto: CreateCashFundsDto, @UserToken() token: string) {
    return this.cashFundsService.create(dto, token);
  }

  @Get()
  findAll(@Query() query: PaginationDto, @UserToken() token: string) {
    return this.cashFundsService.findAll(query, token);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @UserToken() token: string) {
    return this.cashFundsService.findOne(id, token);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateCashFundsDto,
    @UserToken() token: string,
  ) {
    return this.cashFundsService.update(id, dto, token);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @UserToken() token: string) {
    return this.cashFundsService.remove(id, token);
  }
}
