import { IsOptional, IsString, IsObject } from 'class-validator';

export class SaveEntityValuesDto {
  @IsOptional()
  @IsString()
  categoryId?: string | null;

  @IsOptional()
  @IsObject()
  attributes?: Record<string, any>;
}
