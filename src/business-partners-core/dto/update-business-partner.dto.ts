import { PartialType } from '@nestjs/swagger';
import { CreateBusinessPartnerDto } from './create-business-partner.dto';

export class UpdateBusinessPartnerDto extends PartialType(
  CreateBusinessPartnerDto,
) {}
