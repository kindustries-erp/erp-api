import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AiGatewayHealthDto {
  @ApiProperty()
  ok: boolean;

  @ApiProperty()
  latencyMs: number;

  @ApiProperty()
  modelsCount: number;

  @ApiProperty()
  hasApiKey: boolean;

  @ApiProperty({
    type: 'object',
    additionalProperties: { type: 'array', items: { type: 'string' } },
    description: 'Model của từng tier đã cấu hình, theo thứ tự ưu tiên',
  })
  tiers: Record<string, string[]>;

  @ApiPropertyOptional()
  message?: string;
}
