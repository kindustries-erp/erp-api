import { PartialType } from '@nestjs/swagger';
import { CreateModuleCategoryDto } from './create-module-category.dto';

export class UpdateModuleCategoryDto extends PartialType(
  CreateModuleCategoryDto,
) {}
