import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumberString, IsOptional, IsString, IsUUID } from 'class-validator';

/**
 * Dòng PO đầu vào. Số lượng và đơn giá là chuỗi số (khớp contract v1 và web).
 * `amount` chỉ để tương thích payload cũ: server LUÔN tính lại (xem engine).
 */
export class BaseCreatePurchaseOrderLineDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  itemId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  itemCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  itemName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: 'Số lượng đặt, phải > 0' })
  @IsNumberString()
  qtyOrdered: string;

  @ApiPropertyOptional({ description: 'Đơn giá, không âm' })
  @IsOptional()
  @IsNumberString()
  unitPrice?: string;

  @ApiPropertyOptional({
    description: 'Bỏ qua: server tính lại = qtyOrdered × unitPrice',
  })
  @IsOptional()
  @IsNumberString()
  amount?: string;
}
