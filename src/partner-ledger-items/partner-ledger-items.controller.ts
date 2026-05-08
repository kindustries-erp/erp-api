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
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { DirectusAuthGuard } from '../auth/guards/directus-auth.guard';
import { PartnerLedgerItemsService } from './partner-ledger-items.service';
import { CreatePartnerLedgerItemDto } from './dto/create-partner-ledger-item.dto';
import { UpdatePartnerLedgerItemDto } from './dto/update-partner-ledger-item.dto';
import { PartnerLedgerItemQueryDto } from './dto/partner-ledger-item-query.dto';

@ApiTags('PartnerLedgerItems')
@ApiBearerAuth()
@Controller('partner-ledger-items')
@UseGuards(DirectusAuthGuard)
export class PartnerLedgerItemsController {
  constructor(
    private readonly partnerLedgerItemsService: PartnerLedgerItemsService,
  ) {}

  @Post()
  create(@Body() dto: CreatePartnerLedgerItemDto, @UserToken() token: string) {
    return this.partnerLedgerItemsService.create(dto, token);
  }

  @Get()
  findAll(
    @Query() query: PartnerLedgerItemQueryDto,
    @UserToken() token: string,
  ) {
    return this.partnerLedgerItemsService.findAll(query, token);
  }

  @ApiOperation({ summary: 'Tổng hợp công nợ (AR/AP summary)' })
  @Get('summary')
  getSummary(
    @Query() query: PartnerLedgerItemQueryDto,
    @UserToken() token: string,
  ) {
    return this.partnerLedgerItemsService.getSummary(query, token);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @UserToken() token: string) {
    return this.partnerLedgerItemsService.findOne(id, token);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdatePartnerLedgerItemDto,
    @UserToken() token: string,
  ) {
    return this.partnerLedgerItemsService.update(id, dto, token);
  }

  @ApiOperation({ summary: 'Hủy khoản công nợ (soft cancel)' })
  @Delete(':id')
  remove(@Param('id') id: string, @UserToken() token: string) {
    return this.partnerLedgerItemsService.remove(id, token);
  }
}
