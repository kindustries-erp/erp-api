import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UserEmployeeSummaryDto {
  @ApiProperty() id: string;
  @ApiProperty() fullName: string;
  @ApiProperty() employeeCode: string;
  @ApiPropertyOptional() email?: string;
  @ApiPropertyOptional() phone?: string;
  @ApiProperty() status: string;
}

/** Hình dạng trả ra API. Không bao giờ có `passwordHash`. Thời gian là ISO UTC, client hiển thị theo múi giờ của mình. */
export class UserResponseDto {
  @ApiProperty() id: string;
  @ApiProperty({ type: 'object', additionalProperties: true })
  extraData: Record<string, unknown>;
  @ApiProperty() email: string;
  @ApiProperty() status: string;
  @ApiPropertyOptional({ nullable: true }) employeeId: string | null;
  @ApiPropertyOptional({ nullable: true }) lastLoginAt: Date | null;
  @ApiPropertyOptional({ nullable: true }) passwordChangedAt: Date | null;
  @ApiProperty() createdAt: Date;
  @ApiProperty() updatedAt: Date;
  @ApiPropertyOptional({ type: UserEmployeeSummaryDto, nullable: true })
  employee: UserEmployeeSummaryDto | null;
}
