import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

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
