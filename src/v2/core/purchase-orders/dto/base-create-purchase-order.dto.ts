import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsDateString,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { BaseCreatePurchaseOrderLineDto } from './base-create-purchase-order-line.dto';

/**
 * Tạo PO. KHÔNG có `status` và `createdBy`: trạng thái đi qua endpoint hành động
 * (approve/confirm/cancel) và người tạo lấy từ JWT (H3, #4).
 */
export class BaseCreatePurchaseOrderDto {
  @ApiPropertyOptional({ description: 'Để trống để hệ thống sinh số' })
  @IsOptional()
  @IsString()
  poNo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  supplierId?: string;

  @ApiProperty()
  @IsDateString()
  orderDate: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  expectedDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  remarks?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  supplierInvoiceNo?: string;

  @ApiPropertyOptional({ type: [BaseCreatePurchaseOrderLineDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BaseCreatePurchaseOrderLineDto)
  lines?: BaseCreatePurchaseOrderLineDto[];
}
