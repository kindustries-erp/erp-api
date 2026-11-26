import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import type { PaginationMeta } from '@/common/utils/paginated-result';
import { CaseProgressStage } from '../entities/case-progress.enums';
import type { CaseOrigin, CaseStatus } from '../entities/case-garage.enums';

/** Cập nhật tiến độ một xe. Gửi `null` để xóa giá trị; bỏ field thì giữ nguyên. */
export class UpdateCaseProgressDto {
  @ApiPropertyOptional({
    nullable: true,
    description: 'employees_management.id',
  })
  @IsOptional()
  @IsUUID()
  assigneeId?: string | null;

  @ApiPropertyOptional({ enum: CaseProgressStage, nullable: true })
  @IsOptional()
  @IsEnum(CaseProgressStage)
  progressStage?: CaseProgressStage | null;

  @ApiPropertyOptional({ minimum: 0, maximum: 100, nullable: true })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  progressPercent?: number | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsDateString()
  expectedCompletionAt?: string | null;
}

/** Bộ lọc bảng theo dõi tiến độ. `status` mặc định IN_PROGRESS, `ALL` để lấy mọi trạng thái. */
export class QueryCaseProgressDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  pageSize?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() status?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() assigneeId?: string;
  @ApiPropertyOptional({ enum: CaseProgressStage })
  @IsOptional()
  @IsEnum(CaseProgressStage)
  stage?: CaseProgressStage;
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  overdue?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsString() search?: string;

  /** Mã phân loại (ví dụ `OJ`): khớp danh mục (`category.code`) hoặc cột `classification`. */
  @ApiPropertyOptional({ example: 'OJ' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  classification?: string;
}

/** Một dòng bảng theo dõi tiến độ. */
export interface CaseProgressItem {
  id: string;
  caseCode: string;
  licensePlate: string | null;
  vehicleBrandName: string | null;
  vehicleModelName: string | null;
  customerName: string | null;
  /** Tên khách in trên phiếu KGara (có thể khác `customerName`). */
  voucherCustomerName: string | null;
  receivedAt: string | null;
  startedAt: string | null;
  /** Nội dung sửa chữa: `requestDescription`, thiếu thì tóm tắt từ các dòng hạng mục. */
  workSummary: string | null;
  assigneeId: string | null;
  assigneeName: string | null;
  advisorCode: string | null;
  advisorName: string | null;
  progressStage: string | null;
  progressPercent: number | null;
  expectedCompletionAt: string | null;
  status: CaseStatus;
  /** Nguồn vụ việc: `KGARA_SYNC` đổi trạng thái tự do (ghi đè ở ERP), `NATIVE` theo bảng chuyển. */
  origin: CaseOrigin;
  statusName: string | null;
  completedAt: string | null;
  /** Lúc xe được đưa vào bảng tiến độ xưởng; null là không có trên bảng. */
  workshopTrackedAt: string | null;
  /** Số phút đã làm: (hoàn thành hoặc hiện tại) − (bắt đầu sửa hoặc tiếp nhận). */
  elapsedMinutes: number | null;
  isOverdue: boolean;
  overriddenFields: string[];
}

export interface CaseProgressListResponse {
  items: CaseProgressItem[];
  pagination: PaginationMeta;
}
