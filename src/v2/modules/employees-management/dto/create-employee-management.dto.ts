import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from 'class-validator';
import { ExtraDataField } from '@/v2/core/base-core/dto/extra-data.decorator';

export const EMPLOYEE_STATUSES = ['ACTIVE', 'INACTIVE'] as const;
export type EmployeeStatus = (typeof EMPLOYEE_STATUSES)[number];

/** CCCD 12 số hoặc CMND 9 số. */
export const NATIONAL_ID_PATTERN = /^(\d{9}|\d{12})$/;

/** DTO tạo nhân viên. Không có `userId`: liên kết tài khoản chỉ đi qua users-management. */
export class CreateEmployeeManagementDto {
  @ApiPropertyOptional({ description: 'Bỏ trống thì tự sinh (NV-001...)' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  employeeCode?: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  @MaxLength(255)
  fullName: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  email?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  phone?: string | null;

  @ApiPropertyOptional({ enum: EMPLOYEE_STATUSES })
  @IsOptional()
  @IsIn(EMPLOYEE_STATUSES)
  status?: EmployeeStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  address?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string | null;

  @ApiPropertyOptional({ description: 'ISO 8601, không ở tương lai' })
  @IsOptional()
  @IsDateString()
  birthDate?: string | null;

  @ApiPropertyOptional({ description: 'ISO 8601' })
  @IsOptional()
  @IsDateString()
  startDate?: string | null;

  @ApiPropertyOptional({ description: 'ISO 8601, không trước ngày vào làm' })
  @IsOptional()
  @IsDateString()
  leaveDate?: string | null;

  @ApiPropertyOptional({ description: 'Chức danh' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  jobTitle?: string | null;

  @ApiPropertyOptional({ description: 'Phòng ban (text tự do)' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  department?: string | null;

  @ApiPropertyOptional({ description: 'Chi nhánh (branches_management.id)' })
  @IsOptional()
  @IsUUID()
  branchId?: string | null;

  @ApiPropertyOptional({ description: 'CCCD 12 số hoặc CMND 9 số' })
  @IsOptional()
  @Matches(NATIONAL_ID_PATTERN, { message: 'CCCD phải gồm 9 hoặc 12 chữ số' })
  nationalId?: string | null;

  @ExtraDataField()
  extraData?: Record<string, unknown>;
}
