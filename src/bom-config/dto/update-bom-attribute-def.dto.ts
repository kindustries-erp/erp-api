import { PartialType } from '@nestjs/swagger';
import { CreateBomAttributeDefDto } from './create-bom-attribute-def.dto';

export class UpdateBomAttributeDefDto extends PartialType(
  CreateBomAttributeDefDto,
) {}
