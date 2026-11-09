import { ApiProperty } from '@nestjs/swagger';

export class TablePreferenceResponseDto {
  @ApiProperty() tableId: string;
  @ApiProperty({ type: Object }) columns: Record<string, unknown>;
  @ApiProperty({ type: Object }) views: Record<string, unknown>;
  @ApiProperty({ example: '2026-11-09T00:00:00.000Z' })
  updatedAt: string;
}

export class TablePreferenceListResponseDto {
  @ApiProperty({ type: [TablePreferenceResponseDto] })
  items: TablePreferenceResponseDto[];
}
