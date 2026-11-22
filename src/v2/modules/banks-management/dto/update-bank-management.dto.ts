import { PartialType } from '@nestjs/swagger';
import { CreateBankManagementDto } from './create-bank-management.dto';

export class UpdateBankManagementDto extends PartialType(
  CreateBankManagementDto,
) {}
