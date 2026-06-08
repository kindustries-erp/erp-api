import { PartialType } from '@nestjs/swagger';
import { CreateBomDto } from './create-bom.dto';

export class UpdateBomDto extends PartialType(CreateBomDto) {}
