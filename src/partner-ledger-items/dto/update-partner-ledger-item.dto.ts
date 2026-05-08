import { PartialType } from '@nestjs/swagger';
import { CreatePartnerLedgerItemDto } from './create-partner-ledger-item.dto';

export class UpdatePartnerLedgerItemDto extends PartialType(
  CreatePartnerLedgerItemDto,
) {}
