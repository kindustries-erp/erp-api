import { PartialType } from '@nestjs/swagger';
import { CreateModuleAttrDefDto } from './create-module-attr-def.dto';

export class UpdateModuleAttrDefDto extends PartialType(
  CreateModuleAttrDefDto,
) {}
