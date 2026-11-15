import { ApiProperty } from '@nestjs/swagger';
import { PaginationMetaDto } from '@/common/dto/pagination-meta.dto';

const NULLABLE_STRING = { type: String, nullable: true } as const;
const NULLABLE_OBJECT = {
  type: 'object',
  additionalProperties: true,
  nullable: true,
} as const;

/** Một dòng nhật ký (response, không lộ entity). */
export class AuditLogResponseDto {
  @ApiProperty() id: string;
  @ApiProperty(NULLABLE_STRING) requestId: string | null;
  @ApiProperty(NULLABLE_STRING) actorUserId: string | null;
  @ApiProperty(NULLABLE_STRING) actorEmail: string | null;
  @ApiProperty(NULLABLE_STRING) actorEmployeeId: string | null;
  @ApiProperty() actionType: string;
  @ApiProperty() module: string;
  @ApiProperty(NULLABLE_STRING) entityType: string | null;
  @ApiProperty(NULLABLE_STRING) entityId: string | null;
  @ApiProperty(NULLABLE_STRING) route: string | null;
  @ApiProperty(NULLABLE_STRING) httpMethod: string | null;
  @ApiProperty() status: string;
  @ApiProperty(NULLABLE_STRING) message: string | null;
  @ApiProperty(NULLABLE_STRING) uiScreen: string | null;
  @ApiProperty(NULLABLE_STRING) uiAction: string | null;
  @ApiProperty(NULLABLE_OBJECT) beforeSnapshot: Record<string, unknown> | null;
  @ApiProperty(NULLABLE_OBJECT) afterSnapshot: Record<string, unknown> | null;
  @ApiProperty(NULLABLE_OBJECT) errorSnapshot: Record<string, unknown> | null;
  @ApiProperty(NULLABLE_STRING) ipAddress: string | null;
  @ApiProperty(NULLABLE_STRING) userAgent: string | null;
  @ApiProperty() createdAt: Date;
}

export class AuditLogListResponseDto {
  @ApiProperty({ type: [AuditLogResponseDto] })
  items: AuditLogResponseDto[];

  @ApiProperty({ type: PaginationMetaDto })
  pagination: PaginationMetaDto;
}

export class AuditLogTimelineResponseDto {
  @ApiProperty({ type: [AuditLogResponseDto] })
  items: AuditLogResponseDto[];
}
