import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class OriginalPdfDownloadResponseDto {
  @ApiProperty({ description: 'ID hóa đơn' })
  invoiceId: string;

  @ApiProperty({ description: 'Số hóa đơn' })
  invoiceNo: string;

  @ApiProperty({ description: 'Trạng thái tải thành công hay không' })
  success: boolean;

  @ApiPropertyOptional({ description: 'Nguồn tệp PDF' })
  pdfSource: string | null;

  @ApiPropertyOptional({ description: 'Key lưu trữ tệp trên S3/R2' })
  pdfFileKey: string | null;

  @ApiPropertyOptional({ description: 'Thông báo lỗi nếu tải thất bại' })
  pdfError: string | null;
}

export class OriginalPdfLookupInfoResponseDto {
  @ApiProperty({ description: 'ID hóa đơn' })
  invoiceId: string;

  @ApiProperty({ description: 'Số hóa đơn' })
  invoiceNo: string;

  @ApiProperty({ description: 'Mã nhà cung cấp' })
  providerCode: string;

  @ApiProperty({ description: 'Tên nhà cung cấp giải pháp hóa đơn' })
  providerName: string;

  @ApiPropertyOptional({ description: 'MST tổ chức giải pháp (msttcgp)' })
  msttcgp: string | null;

  @ApiPropertyOptional({ description: 'Mã tra cứu / Salt / Fkey' })
  lookupCode: string | null;

  @ApiPropertyOptional({ description: 'Đường dẫn portal tra cứu' })
  lookupUrl: string | null;

  @ApiPropertyOptional({ description: 'Nguồn tệp PDF hiện tại' })
  pdfSource: string | null;

  @ApiPropertyOptional({ description: 'Key file PDF trên S3/R2' })
  pdfFileKey: string | null;

  @ApiPropertyOptional({ description: 'Chi tiết lỗi nếu tải thất bại' })
  pdfError: string | null;
}

export class SyncAdvancedResponseDto {
  @ApiProperty({ description: 'ID phiên đồng bộ' })
  syncId: string;

  @ApiProperty({ description: 'Tổng số hóa đơn cần tải PDF' })
  totalFound: number;

  @ApiProperty({ description: 'Trạng thái phiên đồng bộ' })
  status: string;
}
