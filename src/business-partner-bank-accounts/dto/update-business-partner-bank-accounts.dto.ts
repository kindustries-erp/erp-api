import { PartialType } from '@nestjs/swagger';
import { CreateBusinessPartnerBankAccountsDto } from './create-business-partner-bank-accounts.dto';

export class UpdateBusinessPartnerBankAccountsDto extends PartialType(
  CreateBusinessPartnerBankAccountsDto,
) {}
