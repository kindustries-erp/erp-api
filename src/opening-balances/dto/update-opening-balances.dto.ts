import { PartialType } from '@nestjs/swagger';
import { CreateOpeningBalancesDto } from './create-opening-balances.dto';

export class UpdateOpeningBalancesDto extends PartialType(
  CreateOpeningBalancesDto,
) {}
