import { PartialType } from '@nestjs/swagger';
import { CreateCashFundsDto } from './create-cash-funds.dto';

export class UpdateCashFundsDto extends PartialType(CreateCashFundsDto) {}
