import { UserToken } from '../common/decorators/user-token.decorator';
import {
  Controller,
  Patch,
  Param,
  Body,
  UseGuards,
  Get,
  Query,
} from '@nestjs/common';
import { EmployeesService } from './employees.service';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { DirectusAuthGuard } from '../auth/guards/directus-auth.guard';
import { PaginationDto } from '../common/dto/pagination.dto';
import { UpdateRolePermissionsDto } from '../rbac/dto/update-permission.dto';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

@ApiTags('Employees')
@ApiBearerAuth()
@Controller('employees')
@UseGuards(DirectusAuthGuard)
export class EmployeesController {
  constructor(private readonly employeesService: EmployeesService) {}

  @Get()
  findAll(@Query() query: PaginationDto, @UserToken() token: string) {
    return this.employeesService.findAll(query, token);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @UserToken() token: string) {
    return this.employeesService.findOne(id, token);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateEmployeeDto: UpdateEmployeeDto,
    @UserToken() token: string,
  ) {
    return this.employeesService.update(id, updateEmployeeDto, token);
  }

  @Get(':id/permissions')
  getPermissions(@Param('id') id: string, @UserToken() token: string) {
    return this.employeesService.getEmployeePermissions(id, token);
  }

  @Patch(':id/permissions')
  updatePermissions(
    @Param('id') id: string,
    @Body() updatePermissionsDto: UpdateRolePermissionsDto,
    @UserToken() token: string,
  ) {
    return this.employeesService.updateEmployeePermissions(
      id,
      updatePermissionsDto,
      token,
    );
  }
}
