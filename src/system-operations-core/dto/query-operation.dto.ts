import { IsOptional, IsString, IsBoolean } from 'class-validator';
import { Transform } from 'class-transformer';

export class QuerySystemOperationDto {
  @IsOptional()
  @IsString()
  module?: string;

  @IsOptional()
  @IsString()
  scopeType?: string;

  @IsOptional()
  @IsString()
  targetId?: string;

  @IsOptional()
  @IsString()
  action?: string;

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  blockingOnly?: boolean;
}
