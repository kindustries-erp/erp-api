import { ApiProperty } from '@nestjs/swagger';

/** Một bước trong nhật ký duyệt. Không lộ id nội bộ của nhật ký. */
export class ApprovalEventResponseDto {
  @ApiProperty() action: string;
  @ApiProperty() fromStatus: string;
  @ApiProperty() toStatus: string;
  @ApiProperty() actorId: string;
  @ApiProperty({ type: [String] }) actorRoles: string[];
  @ApiProperty({ nullable: true }) comment: string | null;
  @ApiProperty() createdAt: Date;
}
