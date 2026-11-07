import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class PaymentRequestLineDto {
  @IsUUID()
  poId: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount: number;
}

export class CreatePaymentRequestDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => PaymentRequestLineDto)
  lines: PaymentRequestLineDto[];

  @IsOptional()
  @IsString()
  @MaxLength(255)
  partnerName?: string;

  @IsOptional()
  @IsUUID()
  branchId?: string;

  @IsOptional()
  @IsString()
  note?: string;

  /** Mặc định theo cấu hình duyệt (bật). */
  @IsOptional()
  requiresApproval?: boolean;
}

export class ReplacePaymentRequestLinesDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => PaymentRequestLineDto)
  lines: PaymentRequestLineDto[];
}

export class PaymentRequestActionDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;

  /** Chỉ dùng khi gửi duyệt: người duyệt được chỉ định. */
  @IsOptional()
  @IsUUID()
  approverId?: string;
}

export class RecordPaymentDto {
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount: number;

  @IsDateString()
  transDate: string;

  @IsOptional()
  @IsIn(['CASH', 'BANK', 'POS', 'OTHER'])
  channel?: 'CASH' | 'BANK' | 'POS' | 'OTHER';

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class VoidPaymentDto {
  @IsString()
  @MaxLength(500)
  reason: string;
}

export class ListPaymentRequestsQueryDto {
  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  pageSize?: number;
}
