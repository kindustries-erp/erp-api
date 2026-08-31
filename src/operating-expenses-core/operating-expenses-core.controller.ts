import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OperatingExpensesCoreService } from './operating-expenses-core.service';
import { CreateOperatingExpenseDto } from './dto/create-operating-expense.dto';
import {
  ApplyRecurringOperatingExpenseDto,
  ListOperatingExpensesQueryDto,
} from './dto/operating-expense-query.dto';

@ApiTags('operating-expenses')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('operating-expenses')
export class OperatingExpensesCoreController {
  constructor(private readonly service: OperatingExpensesCoreService) {}

  @Get()
  findAll(@Query() query: ListOperatingExpensesQueryDto) {
    return this.service.findAll(query);
  }

  @Get('column-options')
  async getColumnOptions(
    @Query('column') column: string,
    @Query('search') search?: string,
    @Query('page') page: string = '1',
    @Query('pageSize') pageSize: string = '20',
    @Query('filters') filters?: string,
    @Query('branch_id') branchId?: string,
  ) {
    return this.service.getColumnOptions(
      column,
      search,
      parseInt(page, 10) || 1,
      parseInt(pageSize, 10) || 20,
      filters,
      branchId,
    );
  }

  @Post()
  create(@Body() dto: CreateOperatingExpenseDto, @Req() req: any) {
    const userId = req?.user?.id;
    return this.service.create(dto, userId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: any) {
    return this.service.update(id, dto);
  }

  @Post(':id/apply-recurring')
  applyRecurring(
    @Param('id') id: string,
    @Body() dto: ApplyRecurringOperatingExpenseDto,
    @Req() req: any,
  ) {
    const userId = req?.user?.id;
    return this.service.applyRecurring(id, dto, userId);
  }

  @Delete(':id')
  softDelete(@Param('id') id: string, @Query('scope') scope?: string) {
    return this.service.softDelete(id, scope);
  }
}
