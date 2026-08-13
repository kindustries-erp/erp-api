import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OperatingExpensesCoreService } from './operating-expenses-core.service';
import { CreateOperatingExpenseDto } from './dto/create-operating-expense.dto';
import { OperationalQueryDto } from '../operational-documents/dto/operational-document.dto';

@ApiTags('operating-expenses')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('operating-expenses')
export class OperatingExpensesCoreController {
  constructor(private readonly service: OperatingExpensesCoreService) {}

  @Get()
  findAll(@Query() query: OperationalQueryDto) {
    return this.service.findAll(query);
  }

  @Post()
  create(@Body() dto: CreateOperatingExpenseDto) {
    return this.service.create(dto);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: any) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  softDelete(@Param('id') id: string) {
    return this.service.softDelete(id);
  }
}
