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
import { ChartOfAccountsService } from './chart-of-accounts.service';
import { CreateChartOfAccountDto } from './dto/create-chart-of-account.dto';
import { UpdateChartOfAccountDto } from './dto/update-chart-of-account.dto';
import { DirectusAuthGuard } from '../auth/guards/directus-auth.guard';

import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { PaginationDto } from '../common/dto/pagination.dto';

@ApiTags('Chart Of Accounts')
@ApiBearerAuth()
@Controller('chart-of-accounts')
@UseGuards(DirectusAuthGuard)
export class ChartOfAccountsController {
  constructor(
    private readonly chartOfAccountsService: ChartOfAccountsService,
  ) {}

  @Post()
  create(
    @Body() createChartOfAccountDto: CreateChartOfAccountDto,
    @UserToken() token: string,
  ) {
    return this.chartOfAccountsService.create(createChartOfAccountDto, token);
  }

  @Get()
  findAll(@Query() query: PaginationDto, @UserToken() token: string) {
    return this.chartOfAccountsService.findAll(query, token);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @UserToken() token: string) {
    return this.chartOfAccountsService.findOne(id, token);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateChartOfAccountDto: UpdateChartOfAccountDto,
    @UserToken() token: string,
  ) {
    return this.chartOfAccountsService.update(
      id,
      updateChartOfAccountDto,
      token,
    );
  }

  @Delete(':id')
  remove(@Param('id') id: string, @UserToken() token: string) {
    return this.chartOfAccountsService.remove(id, token);
  }
}
