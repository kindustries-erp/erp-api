import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

export class ListCoreRolesDto {
  @ApiPropertyOptional()
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional()
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  pageSize?: number = 20;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional()
  @IsOptional()
  sorts?: string | string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  column_filters?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  column_search?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  date_from?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  date_to?: string;
}

export class CreateCoreRoleDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;
}

export class UpdateCoreRoleDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class CorePermissionDto {
  @IsString()
  resource: string;

  @IsString()
  action: string;

  @IsOptional()
  conditions?: any;
}

export class UpdateCoreRolePermissionsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CorePermissionDto)
  permissions: CorePermissionDto[];
}

export class UpdateCoreRoleUsersDto {
  @IsArray()
  @IsString({ each: true })
  userIds: string[];
}
