import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * UC#4 — Cấn trừ tiền cọc vào invoice (Apply advance to invoice)
 *
 * Kế toán: đây là internal settlement — không sinh JE mới vì:
 *   advance voucher JE đã là N111/112 C131-advance
 *   invoice JE đã là N131-trade C511/3331
 * Cấn trừ chỉ cần update settled/open amounts trên cả 2 phía.
 * Trigger DB đảm nhiệm recalc tự động.
 */
export class ApplyAdvanceToInvoiceDto {
  /** ID của payment_vouchers (type=CUSTOMER_ADVANCE_RECEIPT, status=POSTED) */
  @ApiProperty({ description: 'ID advance voucher (phiếu đặt cọc đã post)' })
  @IsUUID()
  advance_voucher_id!: string;

  /** ID của ar_documents (invoice/document đã POSTED, còn open_amount > 0) */
  @ApiProperty({ description: 'ID AR document (invoice đã post, còn công nợ)' })
  @IsUUID()
  ar_document_id!: string;

  /** Số tiền cấn trừ: phải <= min(advance.remaining, invoice.open_amount) */
  @ApiProperty({
    description:
      'Số tiền cấn trừ (≤ advance remaining và ≤ invoice open amount)',
  })
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  amount!: number;

  @ApiProperty({ description: 'Ngày cấn trừ (ISO date)' })
  @IsDateString()
  application_date!: string;

  @ApiPropertyOptional({
    description: 'Số chứng từ cấn trừ (auto-generate nếu bỏ trống)',
  })
  @IsOptional()
  @IsString()
  application_no?: string;

  @ApiPropertyOptional({ description: 'Ghi chú' })
  @IsOptional()
  @IsString()
  reason?: string;
}
