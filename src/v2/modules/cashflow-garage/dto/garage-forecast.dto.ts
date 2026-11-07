import { Type } from 'class-transformer';
import {
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
import {
  CashflowForecast,
  CashflowForecastLine,
} from '@/v2/core/cashflow-core';
import { CashflowGarageForecastExt } from '../entities/cashflow-garage-forecast-ext.entity';

const FORECAST_KINDS = ['PURCHASE', 'COMMISSION', 'CASE_RECEIVABLE', 'OTHER'];

export class CreateGarageForecastLineDto {
  @IsString()
  @MaxLength(255)
  itemName: string;

  @IsOptional()
  @IsIn(['GOODS', 'SERVICE'])
  lineType?: 'GOODS' | 'SERVICE';

  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.001)
  qtyRequested: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  unitPrice: number;
}

/**
 * Tạo dự thu/dự chi Garage. `amount` bắt buộc với dự thu và dự chi thường;
 * dự chi mua hàng (PURCHASE) bỏ qua `amount` và tính từ `lines`.
 */
export class CreateGarageForecastDto {
  @IsIn(['IN', 'OUT'])
  direction: 'IN' | 'OUT';

  @IsIn(FORECAST_KINDS)
  kind: 'PURCHASE' | 'COMMISSION' | 'CASE_RECEIVABLE' | 'OTHER';

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  amount?: number;

  @IsOptional()
  @IsDateString()
  plannedDate?: string;

  @IsOptional()
  @IsUUID()
  branchId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  partnerName?: string;

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsUUID()
  caseId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  licensePlate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  paymentContent?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateGarageForecastLineDto)
  lines?: CreateGarageForecastLineDto[];
}

export class ListGarageForecastsQueryDto {
  @IsOptional()
  @IsIn(['IN', 'OUT'])
  direction?: 'IN' | 'OUT';

  @IsOptional()
  @IsIn(FORECAST_KINDS)
  kind?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsUUID()
  branchId?: string;

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

export class SubmitGarageForecastDto {
  /** Bắt buộc khi chứng từ cần duyệt; không được là chính người gửi. */
  @IsOptional()
  @IsUUID()
  approverId?: string;
}

export class GarageForecastReasonDto {
  @IsOptional()
  @IsString()
  reason?: string;
}

export class GarageForecastLineResponseDto {
  id: string;
  lineNo: number;
  lineType: string;
  itemName: string;
  qtyRequested: number;
  qtyOrdered: number;
  unitPrice: number;
  amount: number;

  static fromEntity(line: CashflowForecastLine): GarageForecastLineResponseDto {
    return {
      id: line.id,
      lineNo: line.lineNo,
      lineType: line.lineType,
      itemName: line.itemName,
      qtyRequested: Number(line.qtyRequested),
      qtyOrdered: Number(line.qtyOrdered),
      unitPrice: Number(line.unitPrice),
      amount: Number(line.amount),
    };
  }
}

export class GarageForecastResponseDto {
  id: string;
  code: string;
  direction: string;
  kind: string;
  status: string;
  amount: number;
  plannedDate: string | null;
  partnerName: string | null;
  branchId: string | null;
  note: string | null;
  requiresApproval: boolean;
  rejectReason: string | null;
  caseId: string | null;
  licensePlate: string | null;
  paymentContent: string | null;
  lines: GarageForecastLineResponseDto[];

  static fromEntity(
    header: CashflowForecast,
    ext: CashflowGarageForecastExt | null,
    lines: CashflowForecastLine[] = [],
  ): GarageForecastResponseDto {
    return {
      id: header.id,
      code: header.code,
      direction: header.direction,
      kind: header.kind,
      status: header.status,
      amount: Number(header.amount),
      plannedDate: header.plannedDate,
      partnerName: header.partnerName,
      branchId: header.branchId,
      note: header.note,
      requiresApproval: header.requiresApproval,
      rejectReason: header.rejectReason ?? null,
      caseId: ext?.caseId ?? null,
      licensePlate: ext?.licensePlate ?? null,
      paymentContent: ext?.paymentContent ?? null,
      lines: lines.map((line) =>
        GarageForecastLineResponseDto.fromEntity(line),
      ),
    };
  }
}
