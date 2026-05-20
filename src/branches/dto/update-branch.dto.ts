import { IsString, IsOptional, IsBoolean } from 'class-validator';

export class UpdateBranchDto {
  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}
