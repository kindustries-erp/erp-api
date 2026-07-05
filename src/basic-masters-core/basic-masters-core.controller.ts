import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import {
  BasicMastersCoreService,
  type BasicMastersQueryDto,
} from './basic-masters-core.service';

@ApiTags('basic-masters-core')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('basic-masters')
export class BasicMastersCoreController {
  constructor(private readonly service: BasicMastersCoreService) {}

  @Get()
  async findBasicLists(@Query() query: BasicMastersQueryDto) {
    return this.service.findBasicLists(query);
  }
}
