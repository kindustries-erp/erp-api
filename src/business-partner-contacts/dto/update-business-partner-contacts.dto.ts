import { PartialType } from '@nestjs/swagger';
import { CreateBusinessPartnerContactsDto } from './create-business-partner-contacts.dto';

export class UpdateBusinessPartnerContactsDto extends PartialType(
  CreateBusinessPartnerContactsDto,
) {}
