import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class BankManagementResponseDto {
  @ApiProperty({ description: 'ID ngân hàng (UUID)' })
  id: string;

  @ApiProperty({ description: 'Mã ngân hàng (viết tắt)', example: 'VCB' })
  code: string;

  @ApiProperty({ description: 'Tên ngắn ngân hàng', example: 'Vietcombank' })
  shortName: string;

  @ApiProperty({
    description: 'Tên đầy đủ ngân hàng',
    example: 'Ngân hàng TMCP Ngoại thương Việt Nam',
  })
  name: string;

  @ApiProperty({ description: 'Mã BIN Napas', example: '970436' })
  bin: string;

  @ApiPropertyOptional({
    description: 'Link ảnh logo ngân hàng',
    nullable: true,
  })
  logoUrl?: string | null;

  @ApiProperty({ description: 'Danh sách tên gọi khác', type: [String] })
  aliases: string[];

  @ApiProperty({ description: 'Trạng thái hoạt động' })
  isActive: boolean;

  @ApiProperty({ description: 'Có hỗ trợ chuyển khoản nhanh 24/7' })
  transferSupported: boolean;

  @ApiProperty({ description: 'Có hỗ trợ tra cứu số tài khoản' })
  lookupSupported: boolean;

  @ApiPropertyOptional({
    description: 'Thời điểm đồng bộ VietQR gần nhất',
    nullable: true,
  })
  syncedAt?: Date | null;

  @ApiProperty({
    description: 'Dữ liệu mở rộng',
    type: 'object',
    additionalProperties: true,
  })
  extraData: Record<string, unknown>;

  @ApiProperty({ description: 'Thời điểm tạo' })
  createdAt: Date;

  @ApiProperty({ description: 'Thời điểm cập nhật' })
  updatedAt: Date;
}
