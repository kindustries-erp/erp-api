import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsOptional } from 'class-validator';
import { FileCategory } from '@/v2/core/storage-core';

export class UploadInvoiceAttachmentBodyDto {
  @ApiPropertyOptional({
    enum: Object.values(FileCategory),
    default: 'HOA_DON',
  })
  @IsOptional()
  @IsIn(Object.values(FileCategory))
  category?: FileCategory;
}

export class InvoiceAttachmentDownloadQueryDto {
  @ApiPropertyOptional({
    description: 'true: mở xem trước (inline); mặc định tải về',
  })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  inline?: boolean;
}
