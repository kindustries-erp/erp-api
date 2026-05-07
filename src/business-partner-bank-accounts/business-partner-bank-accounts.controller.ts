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
import { BusinessPartnerBankAccountsService } from './business-partner-bank-accounts.service';
import { CreateBusinessPartnerBankAccountsDto } from './dto/create-business-partner-bank-accounts.dto';
import { UpdateBusinessPartnerBankAccountsDto } from './dto/update-business-partner-bank-accounts.dto';

@ApiTags('BusinessPartnerBankAccounts')
@ApiBearerAuth()
@Controller('business-partner-bank-accounts')
@UseGuards(DirectusAuthGuard)
export class BusinessPartnerBankAccountsController {
  constructor(
    private readonly businessPartnerBankAccountsService: BusinessPartnerBankAccountsService,
  ) {}

  @Post()
  create(
    @Body() dto: CreateBusinessPartnerBankAccountsDto,
    @UserToken() token: string,
  ) {
    return this.businessPartnerBankAccountsService.create(dto, token);
  }

  @Get()
  findAll(@Query() query: PaginationDto, @UserToken() token: string) {
    return this.businessPartnerBankAccountsService.findAll(query, token);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @UserToken() token: string) {
    return this.businessPartnerBankAccountsService.findOne(id, token);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateBusinessPartnerBankAccountsDto,
    @UserToken() token: string,
  ) {
    return this.businessPartnerBankAccountsService.update(id, dto, token);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @UserToken() token: string) {
    return this.businessPartnerBankAccountsService.remove(id, token);
  }
}
