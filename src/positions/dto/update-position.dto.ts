import {
  IsString,
  IsOptional,
  IsBoolean,
  IsNumber,
  IsUUID,
} from 'class-validator';

export class UpdatePositionDto {
  @IsOptional()
  @IsString()
  position_code?: string;

  @IsOptional()
  @IsString()
  position_name?: string;

  @IsOptional()
  @IsString()
  department_group?: string;

  @IsOptional()
  @IsNumber()
  approval_level?: number;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  @IsOptional()
  @IsNumber()
  sort?: number;

  @IsOptional()
  @IsUUID()
  department_id?: string;
}
