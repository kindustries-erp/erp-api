import { PartialType } from '@nestjs/swagger';
import { CreateBomCategoryDto } from './create-bom-category.dto';

export class UpdateBomCategoryDto extends PartialType(CreateBomCategoryDto) {}
