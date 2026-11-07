import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { BaseCreateStockVoucherDto } from '@/v2/core/inventory-movements-core';
import { BaseCreateStockVoucherLineDto } from '@/v2/core/inventory-movements-core';

/** Dòng điều chỉnh: `direction` IN tăng tồn (cần giá), OUT giảm tồn. */
export class CreateInventoryMovementsGarageAdjustmentLineDto extends BaseCreateStockVoucherLineDto {
  @ApiProperty({ enum: ['IN', 'OUT'] })
  @IsIn(['IN', 'OUT'])
  direction: 'IN' | 'OUT';
}

/** Tạo phiếu điều chỉnh kho Garage ở trạng thái nháp. Bỏ trống số phiếu thì hệ thống tự sinh. */
export class CreateInventoryMovementsGarageAdjustmentDto extends BaseCreateStockVoucherDto {
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

  @ApiPropertyOptional({
    type: [CreateInventoryMovementsGarageAdjustmentLineDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateInventoryMovementsGarageAdjustmentLineDto)
  lines?: CreateInventoryMovementsGarageAdjustmentLineDto[];
}
