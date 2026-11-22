import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** File đính kèm trả cho client. Không lộ `file_key` (khóa R2 nội bộ). */
export class FileAttachmentResponseDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty() ownerType: string;
  @ApiProperty({ format: 'uuid' }) ownerId: string;
  @ApiProperty() category: string;
  @ApiProperty() isOriginal: boolean;
  @ApiProperty() fileName: string;
  @ApiProperty() fileSize: number;
  @ApiPropertyOptional({ nullable: true, type: String }) mimeType:
    | string
    | null;
  @ApiProperty({ enum: ['V2', 'LEGACY'] }) origin: string;
  @ApiPropertyOptional({ nullable: true, type: String }) createdBy:
    | string
    | null;
  @ApiProperty() createdAt: string;
  @ApiProperty() isDeleted: boolean;
  @ApiPropertyOptional({ nullable: true, type: String }) deletedAt:
    | string
    | null;
  @ApiPropertyOptional({ nullable: true, type: String }) deletedBy:
    | string
    | null;
}
