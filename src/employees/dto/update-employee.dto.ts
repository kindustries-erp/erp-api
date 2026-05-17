import {
  IsOptional,
  IsString,
  IsBoolean,
  IsDateString,
  IsEmail,
  ValidateIf,
} from 'class-validator';

export class UpdateEmployeeDto {
  @IsOptional()
  @IsString()
  employee_code?: string;

  @IsOptional()
  @IsString()
  full_name?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @ValidateIf((o) => o.phone !== null)
  @IsString()
  phone?: string | null;

  @IsOptional()
  @IsString()
  manager_employee_id?: string;

  @IsOptional()
  @IsString()
  business_partner_id?: string;

  @IsOptional()
  @IsString()
  employment_status?: string;

  @IsOptional()
  @ValidateIf((o) => o.hire_date !== null)
  @IsDateString()
  hire_date?: string | null;

  @IsOptional()
  @ValidateIf((o) => o.resign_date !== null)
  @IsDateString()
  resign_date?: string | null;

  @IsOptional()
  @IsString()
  signature_file_id?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  @IsOptional()
  @IsString()
  department_id?: string;

  @IsOptional()
  @ValidateIf((o) => o.position_id !== null)
  @IsString()
  position_id?: string | null;

  @IsOptional()
  @ValidateIf((o) => o.policy_id !== null)
  @IsString()
  policy_id?: string | null;

  @IsOptional()
  @ValidateIf((o) => o.role_id !== null)
  @IsString()
  role_id?: string | null;
}
