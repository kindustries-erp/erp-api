import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { ExtraDataField } from '@/v2/core/base-core/dto/extra-data.decorator';
import { CaseStatus } from '../entities/case-garage.enums';
import { CaseServiceLineDto } from './case-service-line.dto';

/** Tạo vụ việc nhập tay (origin NATIVE). Chi nhánh ERP lấy từ header `x-erp-branch-id`, không gửi thì để trống. */
export class CreateCaseDto {
  @ApiPropertyOptional({
    description: 'Bỏ trống thì hệ thống tự sinh (VV-YYMM-NNNN)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  caseCode?: string;

  @ApiProperty() @IsString() @MaxLength(50) licensePlate: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  chassisNumber?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  vehicleBrandCode?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  vehicleBrandName?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  vehicleModelCode?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  vehicleModelName?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1900)
  @Max(2100)
  manufactureYear?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  customerCode?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  customerName?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  payerCode?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  payerName?: string;

  @ApiPropertyOptional() @IsOptional() @IsDateString() startedAt?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  expectedCompletionAt?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() requestDescription?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() diagnosis?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  advisorCode?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  advisorName?: string;

  @ApiPropertyOptional() @IsOptional() @IsDateString() issuedAt?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() receivedAt?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() completedAt?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() deliveredAt?: string;

  @ApiPropertyOptional() @IsOptional() @IsUUID() categoryId?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  classification?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  excludeFromReports?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() excludeFromDebt?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsString() internalNotes?: string;

  @ExtraDataField()
  extraData?: Record<string, unknown>;

  @ApiPropertyOptional({ type: [CaseServiceLineDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CaseServiceLineDto)
  services?: CaseServiceLineDto[];
}

/**
 * Sửa header vụ việc. Xe NATIVE sửa mọi field; xe KGARA_SYNC sửa đè được mọi field có nguồn KGara
 * (giá trị lưu ở v2, không ghi ngược KGara), trừ định danh/nguồn và tiền công nợ (400 ở `case-origin.guard`).
 */
export class UpdateCaseDto extends PartialType(CreateCaseDto) {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  classificationManuallyCleared?: boolean;
}

export class UpdateCaseStatusDto {
  @ApiProperty({ enum: CaseStatus }) @IsEnum(CaseStatus) status: CaseStatus;
}

/** Về giá trị KGara: danh sách khóa cần về; bỏ trống thì về mọi field đang sửa đè. */
export class RevertFieldsDto {
  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  fields?: string[];
}
