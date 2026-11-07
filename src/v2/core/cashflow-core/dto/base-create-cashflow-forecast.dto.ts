import {
  IsDateString,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

/** DTO tạo dự thu / dự chi. Module con extend để thêm trường riêng. Không có `requiresApproval`: do facade quyết định theo cấu hình. */
export class BaseCreateCashflowForecastDto {
  @IsIn(['IN', 'OUT'])
  direction: 'IN' | 'OUT';

  @IsIn(['PURCHASE', 'COMMISSION', 'CASE_RECEIVABLE', 'OTHER'])
  kind: 'PURCHASE' | 'COMMISSION' | 'CASE_RECEIVABLE' | 'OTHER';

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  amount: number;

  @IsOptional()
  @IsDateString()
  plannedDate?: string;

  @IsOptional()
  @IsUUID()
  branchId?: string;

  @IsOptional()
  @IsString()
  partnerName?: string;

  @IsOptional()
  @IsString()
  note?: string;
}
