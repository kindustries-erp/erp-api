import { PartialType } from '@nestjs/swagger';
import { CreateErpBusinessPartnerDto } from './create-erp-business-partner.dto';

export class UpdateErpBusinessPartnerDto extends PartialType(
  CreateErpBusinessPartnerDto,
) {}
