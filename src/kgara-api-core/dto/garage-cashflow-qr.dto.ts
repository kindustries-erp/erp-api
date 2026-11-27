import { Transform } from 'class-transformer';
import {
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from 'class-validator';

/** Cắt khoảng trắng hai đầu, chuỗi rỗng thành null; chạy trước validator (ValidationPipe `transform: true`). */
const TrimToNull = () =>
  Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() || null : value,
  );

/**
 * Thông tin thanh toán dựng VietQR của phiếu thu chi garage. Tất cả optional; gửi `null` để xóa.
 * Quy tắc khớp `transfer-qr-core` phía web: BIN 6 chữ số, số TK 1-19 ký tự chữ/số.
 */
export class GarageCashflowQrFieldsDto {
  @TrimToNull()
  @IsUUID()
  @IsOptional()
  qrCompanyAccountId?: string | null;

  @TrimToNull()
  @IsString()
  @Matches(/^\d{6}$/, { message: 'qrBankBin phải gồm 6 chữ số' })
  @IsOptional()
  qrBankBin?: string | null;

  @TrimToNull()
  @IsString()
  @MaxLength(50)
  @IsOptional()
  qrBankCode?: string | null;

  @TrimToNull()
  @IsString()
  @Matches(/^[A-Za-z0-9]{1,19}$/, {
    message: 'qrAccountNumber chỉ gồm 1-19 ký tự chữ hoặc số',
  })
  @IsOptional()
  qrAccountNumber?: string | null;

  @TrimToNull()
  @IsString()
  @MaxLength(255)
  @IsOptional()
  qrAccountName?: string | null;

  @TrimToNull()
  @IsString()
  @MaxLength(255)
  @IsOptional()
  qrTransferContent?: string | null;
}
