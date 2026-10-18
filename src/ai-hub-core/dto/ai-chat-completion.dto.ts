import {
  IsArray,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ChatMessageDto {
  @IsEnum(['system', 'user', 'assistant'])
  role: 'system' | 'user' | 'assistant';

  @IsString()
  content: string;
}

export class AiChatCompletionDto {
  @IsOptional()
  @IsString()
  model?: string;

  @IsOptional()
  @IsEnum(['low', 'medium', 'high', 'ultra'])
  tier?: 'low' | 'medium' | 'high' | 'ultra';

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChatMessageDto)
  messages: ChatMessageDto[];

  @IsOptional()
  @IsNumber()
  temperature?: number;

  @IsOptional()
  @IsNumber()
  max_tokens?: number;
}
