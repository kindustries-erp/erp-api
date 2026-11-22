import { ApiProperty } from '@nestjs/swagger';

/** Một bước trong nhật ký duyệt. Không lộ id nội bộ của nhật ký. */
export class ApprovalEventResponseDto {
  @ApiProperty() action: string;
  @ApiProperty() fromStatus: string;
  @ApiProperty() toStatus: string;
  @ApiProperty() actorId: string;
  @ApiProperty({ nullable: true, description: 'Họ tên nhân viên' })
  actorName: string | null;
  @ApiProperty({ nullable: true, description: 'Email đăng nhập' })
  actorEmail: string | null;
  @ApiProperty({ type: [String] }) actorRoles: string[];
  @ApiProperty({ nullable: true }) comment: string | null;
  @ApiProperty() createdAt: Date;
}
