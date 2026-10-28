import { IsOptional, IsString, IsBoolean } from 'class-validator';

export class SyncAllDto {
  @IsOptional()
  @IsString()
  branchId?: string;

  @IsOptional()
  @IsString()
  from?: string;

  @IsOptional()
  @IsString()
  to?: string;

  @IsOptional()
  @IsBoolean()
  includeDetails?: boolean;

  @IsOptional()
  @IsBoolean()
  forceDetails?: boolean;
}
