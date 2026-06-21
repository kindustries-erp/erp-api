import { PartialType } from '@nestjs/swagger';
import { CreateTrackingCategoryDto } from './create-tracking-category.dto';

export class UpdateTrackingCategoryDto extends PartialType(
  CreateTrackingCategoryDto,
) {}
