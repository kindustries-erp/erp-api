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
import { BusinessPartnerRolesService } from './business-partner-roles.service';
import { CreateBusinessPartnerRoleDto } from './dto/create-business-partner-role.dto';
import { UpdateBusinessPartnerRoleDto } from './dto/update-business-partner-role.dto';
import { DirectusAuthGuard } from '../auth/guards/directus-auth.guard';

import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { PaginationDto } from '../common/dto/pagination.dto';

@ApiTags('Business Partner Roles')
@ApiBearerAuth()
@Controller('business-partner-roles')
@UseGuards(DirectusAuthGuard)
export class BusinessPartnerRolesController {
  constructor(
    private readonly businessPartnerRolesService: BusinessPartnerRolesService,
  ) {}

  @Post()
  create(
    @Body() createBusinessPartnerRoleDto: CreateBusinessPartnerRoleDto,
    @UserToken() token: string,
  ) {
    return this.businessPartnerRolesService.create(
      createBusinessPartnerRoleDto,
      token,
    );
  }

  @Get()
  findAll(@Query() query: PaginationDto, @UserToken() token: string) {
    return this.businessPartnerRolesService.findAll(query, token);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @UserToken() token: string) {
    return this.businessPartnerRolesService.findOne(id, token);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateBusinessPartnerRoleDto: UpdateBusinessPartnerRoleDto,
    @UserToken() token: string,
  ) {
    return this.businessPartnerRolesService.update(
      id,
      updateBusinessPartnerRoleDto,
      token,
    );
  }

  @Delete(':id')
  remove(@Param('id') id: string, @UserToken() token: string) {
    return this.businessPartnerRolesService.remove(id, token);
  }
}
