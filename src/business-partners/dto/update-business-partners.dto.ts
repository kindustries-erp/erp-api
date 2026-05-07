import { PartialType } from '@nestjs/swagger';
import { CreateBusinessPartnersDto } from './create-business-partners.dto';

export class UpdateBusinessPartnersDto extends PartialType(
  CreateBusinessPartnersDto,
) {}
