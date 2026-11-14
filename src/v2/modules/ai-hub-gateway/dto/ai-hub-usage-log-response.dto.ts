import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** Hình dạng dữ liệu trả ra API. Không trả entity trực tiếp. */
export class AiHubUsageLogResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ type: 'object', additionalProperties: true })
  extraData: Record<string, unknown>;

  @ApiPropertyOptional()
  requestId?: string;

  @ApiPropertyOptional()
  actorUserId?: string;

  @ApiProperty()
  featureCode: string;

  @ApiProperty()
  tier: string;

  @ApiProperty()
  modelName: string;

  @ApiPropertyOptional()
  promptTokens: number;

  @ApiPropertyOptional()
  completionTokens: number;

  @ApiPropertyOptional()
  totalTokens: number;

  @ApiPropertyOptional()
  latencyMs: number;

  @ApiProperty()
  outcome: string;

  @ApiPropertyOptional()
  errorMessage?: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
