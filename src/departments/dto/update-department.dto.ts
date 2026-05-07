import {
  IsString,
  IsOptional,
  IsBoolean,
  IsNumber,
  IsUUID,
} from 'class-validator';

export class UpdateDepartmentDto {
  @IsOptional()
  @IsString()
  department_code?: string;

  @IsOptional()
  @IsString()
  department_name?: string;

  @IsOptional()
  @IsUUID()
  parent_department_id?: string;

  @IsOptional()
  @IsUUID()
  manager_employee_id?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  @IsOptional()
  @IsNumber()
  sort?: number;
}
