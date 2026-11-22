import { ApiProperty } from '@nestjs/swagger';
import { PaginationMetaDto } from '@/common/dto/pagination-meta.dto';

export class NotificationResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  title: string;

  @ApiProperty()
  message: string;

  @ApiProperty({ enum: ['INFO', 'WARNING', 'ERROR', 'SUCCESS'] })
  type: string;

  @ApiProperty()
  isRead: boolean;

  @ApiProperty({ nullable: true, type: String })
  readAt: string | null;

  @ApiProperty()
  createdAt: string;

  @ApiProperty({ type: Object })
  extraData: Record<string, unknown>;

  @ApiProperty({
    nullable: true,
    type: Object,
    description: 'Chứng từ liên quan để FE mở drawer/modal tương ứng',
  })
  target: { module: string; id: string; action: string | null } | null;
}

/** Dữ liệu phụ của danh sách thông báo (`extraData`). */
export class NotificationListExtraDataDto {
  @ApiProperty({
    description: 'Số thông báo chưa đọc của user (không phụ thuộc bộ lọc)',
  })
  unreadCount: number;
}

export class NotificationListResponseDto {
  @ApiProperty({ type: [NotificationResponseDto] })
  items: NotificationResponseDto[];

  @ApiProperty({ type: PaginationMetaDto })
  pagination: PaginationMetaDto;

  @ApiProperty({ type: NotificationListExtraDataDto })
  extraData: NotificationListExtraDataDto;
}

export class NotificationActionResponseDto<T> {
  @ApiProperty()
  message: string;

  @ApiProperty()
  data: T;
}

export class NotificationAffectedDto {
  @ApiProperty()
  affected: number;
}
