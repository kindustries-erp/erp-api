import { PartialType } from '@nestjs/swagger';
import { CreateGarageItemDto } from './create-garage-item.dto';

export class UpdateGarageItemDto extends PartialType(CreateGarageItemDto) {}
