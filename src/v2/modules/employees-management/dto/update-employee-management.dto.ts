import { PartialType } from '@nestjs/swagger';
import { CreateEmployeeManagementDto } from './create-employee-management.dto';

export class UpdateEmployeeManagementDto extends PartialType(
  CreateEmployeeManagementDto,
) {}
