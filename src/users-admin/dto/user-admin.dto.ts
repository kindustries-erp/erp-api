import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';

export class CreateUserAdminDto {
  @IsString()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;

  @IsOptional()
  @IsString()
  employeeId?: string;
}

export class UpdateUserAdminDto {
  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  employeeId?: string | null;
}

export class ResetPasswordAdminDto {
  @IsString()
  @MinLength(8)
  newPassword: string;
}

export class ChangePasswordSelfDto {
  @IsString()
  oldPassword: string;

  @IsString()
  @MinLength(8)
  newPassword: string;
}

export class LinkEmployeeDto {
  @IsString()
  employeeId: string;
}

export class ListUsersAdminDto {
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
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  linkedEmployee?: boolean;

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
