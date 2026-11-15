import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class ImpersonateDto {
  @ApiProperty()
  @IsUUID('4', { message: 'targetUserId phải là UUID hợp lệ' })
  targetUserId: string;
}
