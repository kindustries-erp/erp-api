import { PartialType } from '@nestjs/swagger';
import { CreateAccountingConfigsCoreDto } from './create-accounting-configs-core.dto';

export class UpdateAccountingConfigsCoreDto extends PartialType(
  CreateAccountingConfigsCoreDto,
) {}
