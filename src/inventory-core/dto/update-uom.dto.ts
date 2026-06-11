import { PartialType } from '@nestjs/swagger';
import { CreateUomDto } from './create-uom.dto';

export class UpdateUomDto extends PartialType(CreateUomDto) {}
