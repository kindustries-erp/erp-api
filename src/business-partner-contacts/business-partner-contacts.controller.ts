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
import { BusinessPartnerContactsService } from './business-partner-contacts.service';
import { CreateBusinessPartnerContactsDto } from './dto/create-business-partner-contacts.dto';
import { UpdateBusinessPartnerContactsDto } from './dto/update-business-partner-contacts.dto';

@ApiTags('BusinessPartnerContacts')
@ApiBearerAuth()
@Controller('business-partner-contacts')
@UseGuards(DirectusAuthGuard)
export class BusinessPartnerContactsController {
  constructor(
    private readonly businessPartnerContactsService: BusinessPartnerContactsService,
  ) {}

  @Post()
  create(
    @Body() dto: CreateBusinessPartnerContactsDto,
    @UserToken() token: string,
  ) {
    return this.businessPartnerContactsService.create(dto, token);
  }

  @Get()
  findAll(@Query() query: PaginationDto, @UserToken() token: string) {
    return this.businessPartnerContactsService.findAll(query, token);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @UserToken() token: string) {
    return this.businessPartnerContactsService.findOne(id, token);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateBusinessPartnerContactsDto,
    @UserToken() token: string,
  ) {
    return this.businessPartnerContactsService.update(id, dto, token);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @UserToken() token: string) {
    return this.businessPartnerContactsService.remove(id, token);
  }
}
