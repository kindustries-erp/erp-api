import { PartialType } from '@nestjs/swagger';
import { CreateInventoryItemDto } from './create-item.dto';

export class UpdateInventoryItemDto extends PartialType(
  CreateInventoryItemDto,
) {}
