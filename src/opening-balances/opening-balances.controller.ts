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
import { OpeningBalancesService } from './opening-balances.service';
import { CreateOpeningBalancesDto } from './dto/create-opening-balances.dto';
import { UpdateOpeningBalancesDto } from './dto/update-opening-balances.dto';

@ApiTags('OpeningBalances')
@ApiBearerAuth()
@Controller('opening-balances')
@UseGuards(DirectusAuthGuard)
export class OpeningBalancesController {
  constructor(
    private readonly openingBalancesService: OpeningBalancesService,
  ) {}

  @Post()
  create(@Body() dto: CreateOpeningBalancesDto, @UserToken() token: string) {
    return this.openingBalancesService.create(dto, token);
  }

  @Get()
  findAll(@Query() query: PaginationDto, @UserToken() token: string) {
    return this.openingBalancesService.findAll(query, token);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @UserToken() token: string) {
    return this.openingBalancesService.findOne(id, token);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateOpeningBalancesDto,
    @UserToken() token: string,
  ) {
    return this.openingBalancesService.update(id, dto, token);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @UserToken() token: string) {
    return this.openingBalancesService.remove(id, token);
  }
}
