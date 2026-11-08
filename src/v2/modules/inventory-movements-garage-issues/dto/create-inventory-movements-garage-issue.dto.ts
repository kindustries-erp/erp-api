import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { BaseCreateStockVoucherDto } from '@/v2/core/inventory-movements-core';
import { BaseCreateStockVoucherLineDto } from '@/v2/core/inventory-movements-core';

export class CreateInventoryMovementsGarageIssueLineDto extends BaseCreateStockVoucherLineDto {}

/** Tạo phiếu xuất kho Garage ở trạng thái nháp. Bỏ trống số phiếu thì hệ thống tự sinh. */
export class CreateInventoryMovementsGarageIssueDto extends BaseCreateStockVoucherDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  voucherNo?: string;

  @ApiProperty()
  @IsDateString()
  voucherDate: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  branchId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  partnerName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  remarks?: string;

  @ApiPropertyOptional({ type: [CreateInventoryMovementsGarageIssueLineDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateInventoryMovementsGarageIssueLineDto)
  lines?: CreateInventoryMovementsGarageIssueLineDto[];
}
