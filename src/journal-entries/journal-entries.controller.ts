import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { DirectusAuthGuard } from '../auth/guards/directus-auth.guard';
import { UserToken } from '../common/decorators/user-token.decorator';
import { JournalEntriesService } from './journal-entries.service';
import { JournalEntryQueryDto } from './dto/journal-entry-query.dto';
import { CreateJournalEntryDto } from './dto/create-journal-entry.dto';

@ApiTags('JournalEntries')
@ApiBearerAuth()
@Controller('journal-entries')
@UseGuards(DirectusAuthGuard)
export class JournalEntriesController {
  constructor(private readonly journalEntriesService: JournalEntriesService) {}

  @ApiOperation({
    summary: 'Danh sách bút toán (filter by account/period/status/date)',
  })
  @Get()
  findAll(@Query() query: JournalEntryQueryDto, @UserToken() token: string) {
    return this.journalEntriesService.findAll(query, token);
  }

  @ApiOperation({ summary: 'Lookup: danh sách kỳ kế toán' })
  @Get('lookup/periods')
  findPeriodOptions(@UserToken() token: string) {
    return this.journalEntriesService.findPeriodOptions(token);
  }

  @ApiOperation({ summary: 'Lookup: danh sách tài khoản kế toán' })
  @Get('lookup/accounts')
  findAccountOptions(
    @Query('search') search: string,
    @UserToken() token: string,
  ) {
    return this.journalEntriesService.findAccountOptions(search, token);
  }

  @ApiOperation({ summary: 'Chi tiết bút toán (bao gồm các dòng)' })
  @Get(':id')
  findOne(@Param('id') id: string, @UserToken() token: string) {
    return this.journalEntriesService.findOne(id, token);
  }

  @ApiOperation({
    summary: 'Tạo bút toán thủ công (draft, balanced debit = credit)',
  })
  @Post()
  create(@Body() dto: CreateJournalEntryDto, @UserToken() token: string) {
    return this.journalEntriesService.create(dto, token);
  }

  @ApiOperation({ summary: 'Hạch toán bút toán (draft -> posted)' })
  @Post(':id/post')
  post(@Param('id') id: string, @UserToken() token: string) {
    return this.journalEntriesService.post(id, token);
  }

}
