import { IsOptional, IsString, IsNotEmpty } from 'class-validator';
import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';

export class VoucherApproveDto {
  @ApiPropertyOptional({ description: 'Ghi chú khi duyệt (tuỳ chọn)' })
  @IsOptional()
  @IsString()
  note?: string;
}

export class VoucherRejectDto {
  @ApiProperty({ description: 'Lý do từ chối (bắt buộc)' })
  @IsString()
  @IsNotEmpty()
  note!: string;
}

export class VoucherCancelDto {
  @ApiProperty({ description: 'Lý do hủy phiếu (bắt buộc)' })
  @IsString()
  @IsNotEmpty()
  cancel_reason!: string;
}
