import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PaginationDto } from '../common/dto/pagination.dto';
import { BusinessPartnersCoreService } from './business-partners-core.service';
import { CreateBusinessPartnerDto } from './dto/create-business-partner.dto';
import { UpdateBusinessPartnerDto } from './dto/update-business-partner.dto';

@ApiTags('erp_business_partners')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('business-partners')
export class BusinessPartnersCoreController {
  constructor(private readonly service: BusinessPartnersCoreService) {}

  @Post()
  create(@Body() dto: CreateBusinessPartnerDto) {
    return this.service.create(dto);
  }

  @Get()
  findAll(@Query() query: PaginationDto) {
    return this.service.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateBusinessPartnerDto) {
    return this.service.update(id, dto);
  }
}
