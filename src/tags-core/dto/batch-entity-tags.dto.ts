import { IsArray, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class BatchEntityTagQuery {
  @IsString()
  entityType: string;

  @IsString()
  entityId: string;
}

export class BatchEntityTagsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BatchEntityTagQuery)
  queries: BatchEntityTagQuery[];
}
