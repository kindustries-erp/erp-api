import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreatePurchaseRequestDto {
  @ApiProperty()
  @IsString()
  requestNo: string;

  @ApiProperty()
  @IsDateString()
  requestDate: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  requesterEmployeeId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  remarks?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  createdBy?: string;
}
