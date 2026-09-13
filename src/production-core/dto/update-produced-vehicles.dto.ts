import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

export class UpdateProducedVehicleItemDto {
  @ApiProperty({ description: 'ID của xe (erp_vehicles.id)' })
  @IsNotEmpty()
  @IsString()
  id: string;

  @ApiPropertyOptional({ description: 'Số khung (VIN)' })
  @IsOptional()
  @IsString()
  vinNo?: string;

  @ApiPropertyOptional({ description: 'Số máy' })
  @IsOptional()
  @IsString()
  engineNo?: string;

  @ApiPropertyOptional({ description: 'Số Serial tem xe ngoài (tùy chọn)' })
  @IsOptional()
  @IsString()
  serialNo?: string;

  @ApiPropertyOptional({ description: 'Số Serial nội bộ ERP (tùy chọn)' })
  @IsOptional()
  @IsString()
  internalSerialNo?: string;

  @ApiPropertyOptional({ description: 'Số Lô (tùy chọn)' })
  @IsOptional()
  @IsString()
  lotNo?: string;

  @ApiPropertyOptional({ description: 'Ghi chú' })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateProducedVehiclesDto {
  @ApiProperty({
    description: 'Danh sách các xe cần cập nhật thông tin',
    type: [UpdateProducedVehicleItemDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateProducedVehicleItemDto)
  vehicles: UpdateProducedVehicleItemDto[];
}
