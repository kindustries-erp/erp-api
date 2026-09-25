import {
  IsBoolean,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreatePromptTemplateDto {
  @IsString()
  templateCode: string;

  @IsString()
  moduleCode: string;

  @IsOptional()
  @IsNumber()
  version?: number;

  @IsString()
  systemPrompt: string;

  @IsString()
  userPromptTemplate: string;

  @IsOptional()
  @IsObject()
  inputSchemaJson?: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
