import { UserToken } from '../common/decorators/user-token.decorator';
import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  UseGuards,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { DirectusAuthGuard } from '../auth/guards/directus-auth.guard';
import { PartnerLedgerSettlementsService } from './partner-ledger-settlements.service';
import { CreatePartnerLedgerSettlementDto } from './dto/create-partner-ledger-settlement.dto';
import { PartnerLedgerSettlementQueryDto } from './dto/partner-ledger-settlement-query.dto';

@ApiTags('PartnerLedgerSettlements')
@ApiBearerAuth()
@Controller('partner-ledger-settlements')
@UseGuards(DirectusAuthGuard)
export class PartnerLedgerSettlementsController {
  constructor(
    private readonly partnerLedgerSettlementsService: PartnerLedgerSettlementsService,
  ) {}

  @Post()
  create(
    @Body() dto: CreatePartnerLedgerSettlementDto,
    @UserToken() token: string,
  ) {
    return this.partnerLedgerSettlementsService.create(dto, token);
  }

  @Get()
  findAll(
    @Query() query: PartnerLedgerSettlementQueryDto,
    @UserToken() token: string,
  ) {
    return this.partnerLedgerSettlementsService.findAll(query, token);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @UserToken() token: string) {
    return this.partnerLedgerSettlementsService.findOne(id, token);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @UserToken() token: string) {
    return this.partnerLedgerSettlementsService.remove(id, token);
  }
}
