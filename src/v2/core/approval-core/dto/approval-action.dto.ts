import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsUUID } from 'class-validator';

/** Body của gửi duyệt. approverId bắt buộc khi khóa bật; bỏ qua khi khóa tắt. */
export class SubmitApprovalDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  approverId?: string;
}

/** Bật/tắt khóa duyệt của một họ chứng từ. */
export class UpdateApprovalSettingDto {
  @ApiProperty({
    description: 'true: cần người duyệt; false: tự duyệt khi gửi',
  })
  @IsBoolean()
  approvalEnabled: boolean;
}
