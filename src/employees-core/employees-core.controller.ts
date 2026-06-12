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
import { CoreRbacGuard } from '../auth/guards/core-rbac.guard';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { PaginationDto } from '../common/dto/pagination.dto';
import { EmployeesCoreService } from './employees-core.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';

@ApiTags('erp_employees')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, CoreRbacGuard)
@RequirePermissions({ resource: 'employees', action: 'manage' })
@Controller('employees')
export class EmployeesCoreController {
  constructor(private readonly service: EmployeesCoreService) {}

  @Post()
  create(@Body() dto: CreateEmployeeDto) {
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
  update(@Param('id') id: string, @Body() dto: UpdateEmployeeDto) {
    return this.service.update(id, dto);
  }
}
