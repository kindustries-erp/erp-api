import {
  IsString,
  IsOptional,
  IsBoolean,
  IsNumber,
  IsUUID,
  IsNotEmpty,
} from 'class-validator';

export class CreateDepartmentDto {
  @IsString()
  @IsNotEmpty()
  department_code: string;

  @IsString()
  @IsNotEmpty()
  department_name: string;

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
