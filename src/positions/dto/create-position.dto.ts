import {
  IsString,
  IsOptional,
  IsBoolean,
  IsNumber,
  IsUUID,
  IsNotEmpty,
} from 'class-validator';

export class CreatePositionDto {
  @IsString()
  @IsNotEmpty()
  position_code: string;

  @IsString()
  @IsNotEmpty()
  position_name: string;

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
