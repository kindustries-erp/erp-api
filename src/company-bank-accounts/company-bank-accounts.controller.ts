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
import { CompanyBankAccountsService } from './company-bank-accounts.service';
import { CreateCompanyBankAccountDto } from './dto/create-company-bank-account.dto';
import { UpdateCompanyBankAccountDto } from './dto/update-company-bank-account.dto';
import { DirectusAuthGuard } from '../auth/guards/directus-auth.guard';

import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { PaginationDto } from '../common/dto/pagination.dto';

@ApiTags('Company Bank Accounts')
@ApiBearerAuth()
@Controller('company-bank-accounts')
@UseGuards(DirectusAuthGuard)
export class CompanyBankAccountsController {
  constructor(
    private readonly companyBankAccountsService: CompanyBankAccountsService,
  ) {}

  @Post()
  create(
    @Body() createCompanyBankAccountDto: CreateCompanyBankAccountDto,
    @UserToken() token: string,
  ) {
    return this.companyBankAccountsService.create(
      createCompanyBankAccountDto,
      token,
    );
  }

  @Get()
  findAll(@Query() query: PaginationDto, @UserToken() token: string) {
    return this.companyBankAccountsService.findAll(query, token);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @UserToken() token: string) {
    return this.companyBankAccountsService.findOne(id, token);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateCompanyBankAccountDto: UpdateCompanyBankAccountDto,
    @UserToken() token: string,
  ) {
    return this.companyBankAccountsService.update(
      id,
      updateCompanyBankAccountDto,
      token,
    );
  }

  @Delete(':id')
  remove(@Param('id') id: string, @UserToken() token: string) {
    return this.companyBankAccountsService.remove(id, token);
  }
}
