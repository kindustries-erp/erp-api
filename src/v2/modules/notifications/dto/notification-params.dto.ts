import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class NotificationParamsDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  id: string;
}
