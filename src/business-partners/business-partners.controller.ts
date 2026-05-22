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
import { BusinessPartnersService } from './business-partners.service';
import { CreateBusinessPartnersDto } from './dto/create-business-partners.dto';
import { UpdateBusinessPartnersDto } from './dto/update-business-partners.dto';
import { BusinessPartnerQueryDto } from './dto/business-partner-query.dto';

@ApiTags('BusinessPartners')
@ApiBearerAuth()
@Controller('business-partners')
@UseGuards(DirectusAuthGuard)
export class BusinessPartnersController {
  constructor(
    private readonly businessPartnersService: BusinessPartnersService,
  ) {}

  @Post()
  create(@Body() dto: CreateBusinessPartnersDto, @UserToken() token: string) {
    return this.businessPartnersService.create(dto, token);
  }

  @Get()
  findAll(@Query() query: BusinessPartnerQueryDto, @UserToken() token: string) {
    return this.businessPartnersService.findAll(query, token);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @UserToken() token: string) {
    return this.businessPartnersService.findOne(id, token);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateBusinessPartnersDto,
    @UserToken() token: string,
  ) {
    return this.businessPartnersService.update(id, dto, token);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @UserToken() token: string) {
    return this.businessPartnersService.remove(id, token);
  }
}
