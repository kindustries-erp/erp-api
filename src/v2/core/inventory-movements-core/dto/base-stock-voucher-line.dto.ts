import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { ExtraDataField } from '../../base-core/dto/extra-data.decorator';

/** Dòng nền khi tạo/sửa chứng từ kho. Module con thêm `direction` nếu cần (phiếu điều chỉnh). */
export class BaseCreateStockVoucherLineDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  itemCode: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  itemName: string;

  @ApiPropertyOptional({ default: 'Cái' })
  @IsOptional()
  @IsString()
  unit?: string;

  @ApiProperty()
  @IsNumber()
  @Min(0.001)
  qty: number;

  @ApiPropertyOptional({
    description: 'Bắt buộc với dòng nhập; bỏ qua với dòng xuất',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  unitCost?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ExtraDataField()
  extraData?: Record<string, unknown>;
}
