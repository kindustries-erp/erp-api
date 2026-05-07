import {
  IsString,
  IsBoolean,
  IsOptional,
  IsArray,
  IsObject,
  IsIn,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

const DIRECTUS_PERMISSION_ACTIONS = [
  'create',
  'read',
  'update',
  'delete',
  'share',
] as const;

export class PermissionConfigDto {
  @IsString()
  collection: string;

  @IsString()
  action: string;

  @IsBoolean()
  access: boolean;

  @IsOptional()
  fields?: string[] | string;

  @IsOptional()
  @IsObject()
  permissions?: any;

  @IsOptional()
  @IsObject()
  validation?: any;

  @IsOptional()
  @IsObject()
  presets?: any;
}

export class UpdateRolePermissionsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PermissionConfigDto)
  permissions: PermissionConfigDto[];
}

export class CreatePermissionDto {
  @IsString()
  policy: string;

  @IsString()
  collection: string;

  @IsString()
  @IsIn(DIRECTUS_PERMISSION_ACTIONS)
  action: string;

  @IsOptional()
  fields?: string[] | string | null;

  @IsOptional()
  permissions?: Record<string, any> | null;

  @IsOptional()
  validation?: Record<string, any> | null;

  @IsOptional()
  presets?: Record<string, any> | null;
}

export class UpdatePermissionDto {
  @IsOptional()
  fields?: string[] | string | null;

  @IsOptional()
  permissions?: Record<string, any> | null;

  @IsOptional()
  validation?: Record<string, any> | null;

  @IsOptional()
  presets?: Record<string, any> | null;
}
