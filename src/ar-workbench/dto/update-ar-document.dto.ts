import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNumber, IsOptional, Min } from 'class-validator';
import { CreateArDocumentDto } from './create-ar-document.dto';

export class UpdateArDocumentDto extends PartialType(CreateArDocumentDto) {
  @ApiPropertyOptional({
    description: 'Số đã thanh toán/cấn trừ; open_amount do DB tính lại',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  settled_amount?: number;
}
