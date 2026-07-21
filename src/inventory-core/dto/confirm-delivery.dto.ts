import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString } from 'class-validator';

export class ConfirmDeliveryDto {
  @ApiProperty()
  @IsDateString()
  deliveryDate: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  notes?: string;
}

export class ConfirmDeliveriesDto extends ConfirmDeliveryDto {
  @ApiProperty()
  @IsString({ each: true })
  serialIds: string[];
}
