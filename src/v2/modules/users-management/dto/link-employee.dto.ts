import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class LinkEmployeeDto {
  @ApiProperty({ description: 'Id nhân viên (employees_management)' })
  @IsUUID()
  employeeId: string;
}
