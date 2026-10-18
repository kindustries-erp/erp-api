import {
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';

export class UpdateAiConfigDto {
  @IsOptional()
  @IsEnum(['low', 'medium', 'high', 'ultra'])
  tierLevel?: 'low' | 'medium' | 'high' | 'ultra';

  @IsOptional()
  @IsString()
  modelOverride?: string | null;

  @IsOptional()
  @IsNumber()
  temperature?: number;

  @IsOptional()
  @IsNumber()
  maxTokens?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  description?: string;
}
