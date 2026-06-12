import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import {
  CreateUserAdminDto,
  LinkEmployeeDto,
  ListUsersAdminDto,
  ResetPasswordAdminDto,
  UpdateUserAdminDto,
} from './dto/user-admin.dto';
import { UsersAdminService } from './users-admin.service';

@ApiTags('admin-users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('admin/users')
export class UsersAdminController {
  constructor(private readonly usersAdminService: UsersAdminService) {}

  @Post()
  create(
    @Body() dto: CreateUserAdminDto,
    @Req() request: Request & { user: { sub: string; email: string } },
  ) {
    return this.usersAdminService.createUser(dto, request);
  }

  @Get()
  list(@Query() query: ListUsersAdminDto) {
    return this.usersAdminService.listUsers(query);
  }

  @Get(':id')
  getOne(@Param('id') id: string) {
    return this.usersAdminService.getUser(id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateUserAdminDto,
    @Req() request: Request & { user: { sub: string; email: string } },
  ) {
    return this.usersAdminService.updateUser(id, dto, request);
  }

  @Post(':id/activate')
  activate(
    @Param('id') id: string,
    @Req() request: Request & { user: { sub: string; email: string } },
  ) {
    return this.usersAdminService.activateUser(id, request);
  }

  @Post(':id/deactivate')
  deactivate(
    @Param('id') id: string,
    @Req() request: Request & { user: { sub: string; email: string } },
  ) {
    return this.usersAdminService.deactivateUser(id, request);
  }

  @Post(':id/reset-password')
  resetPassword(
    @Param('id') id: string,
    @Body() dto: ResetPasswordAdminDto,
    @Req() request: Request & { user: { sub: string; email: string } },
  ) {
    return this.usersAdminService.resetPassword(id, dto, request);
  }

  @Post(':id/link-employee')
  linkEmployee(
    @Param('id') id: string,
    @Body() dto: LinkEmployeeDto,
    @Req() request: Request & { user: { sub: string; email: string } },
  ) {
    return this.usersAdminService.linkEmployee(id, dto, request);
  }

  @Post(':id/unlink-employee')
  unlinkEmployee(
    @Param('id') id: string,
    @Req() request: Request & { user: { sub: string; email: string } },
  ) {
    return this.usersAdminService.unlinkEmployee(id, request);
  }
}
