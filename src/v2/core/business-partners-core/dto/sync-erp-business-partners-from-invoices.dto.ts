import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';

export class SyncErpBusinessPartnersFromInvoicesDto {
  /** true: chỉ trả về danh sách sẽ tạo, không ghi DB. */
  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  dryRun?: boolean;
}
