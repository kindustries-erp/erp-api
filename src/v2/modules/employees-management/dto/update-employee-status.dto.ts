import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';
import {
  EMPLOYEE_STATUSES,
  type EmployeeStatus,
} from './create-employee-management.dto';

export class UpdateEmployeeStatusDto {
  @ApiProperty({ enum: EMPLOYEE_STATUSES })
  @IsIn(EMPLOYEE_STATUSES)
  status: EmployeeStatus;
}
