import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import type { PaginationMeta } from '@/common/utils/paginated-result';
import {
  CaseProgressLogKind,
  CaseProgressStage,
} from '../entities/case-progress.enums';
import type { CaseProgressItem } from './case-progress.dto';

/**
 * Ghi một dòng nhật ký tiến độ xưởng.
 * - `STAGE`: chuyển sang status nhỏ `stage` (bắt buộc, phải thuộc status cha hiện tại); đóng công đoạn đang mở.
 * - `NOTE`: ghi chú `note` (bắt buộc).
 * `startedAt` bỏ trống là hiện tại; sửa tay được khi nhập muộn.
 */
export class CreateCaseProgressLogDto {
  @ApiProperty({ enum: CaseProgressLogKind })
  @IsEnum(CaseProgressLogKind)
  kind: CaseProgressLogKind;

  @ApiPropertyOptional({ enum: CaseProgressStage })
  @ValidateIf(
    (o: CreateCaseProgressLogDto) => o.kind === CaseProgressLogKind.STAGE,
  )
  @IsEnum(CaseProgressStage)
  stage?: CaseProgressStage;

  @ApiPropertyOptional({ maxLength: 2000 })
  @ValidateIf(
    (o: CreateCaseProgressLogDto) =>
      o.kind === CaseProgressLogKind.NOTE || o.note != null,
  )
  @IsString()
  @MaxLength(2000)
  note?: string;

  @ApiPropertyOptional({
    nullable: true,
    description: 'employees_management.id',
  })
  @IsOptional()
  @IsUUID()
  workerId?: string | null;

  /** Tên người làm (giá trị song song); bỏ trống thì lấy tên nhân viên của `workerId`. */
  @ApiPropertyOptional({ nullable: true, maxLength: 255 })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  workerName?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  startedAt?: string;
}

/** Sửa tay một dòng nhật ký. Gửi `null` để xóa giá trị; bỏ field thì giữ nguyên. */
export class UpdateCaseProgressLogDto {
  @ApiPropertyOptional({ nullable: true, maxLength: 2000 })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsUUID()
  workerId?: string | null;

  @ApiPropertyOptional({ nullable: true, maxLength: 255 })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  workerName?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  startedAt?: string;

  /** Chỉ cho dòng `STAGE` đã đóng; không mở lại công đoạn bằng cách gửi `null`. */
  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  endedAt?: string;
}

/** Bộ lọc board xưởng: mặc định mọi status. */
export class QueryWorkshopBoardDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ maximum: 200 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  pageSize?: number;

  @ApiPropertyOptional() @IsOptional() @IsString() search?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() assigneeId?: string;

  /** Xe đã hoàn thành/hủy chỉ hiện trong số ngày này (mặc định 7). */
  @ApiPropertyOptional({ minimum: 1, maximum: 90, default: 7 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(90)
  finishedDays?: number;
}

/** Một dòng nhật ký trong timeline. `durationMinutes` tính tới `endedAt` hoặc hiện tại (với STAGE). */
export interface CaseProgressLogItem {
  id: string;
  caseId: string;
  kind: CaseProgressLogKind;
  caseStatus: string;
  stage: string | null;
  note: string | null;
  workerId: string | null;
  workerName: string | null;
  startedAt: string;
  endedAt: string | null;
  durationMinutes: number | null;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Thẻ xe trên board xưởng: dòng tiến độ + thời gian công đoạn. */
export interface CaseWorkshopBoardItem extends CaseProgressItem {
  /** Bắt đầu công đoạn đang mở; null khi chưa ghi công đoạn. */
  stageStartedAt: string | null;
  stageElapsedMinutes: number | null;
  /** Từ lúc tiếp nhận tới hoàn thành (hoặc hiện tại). */
  totalElapsedMinutes: number | null;
  /** Người làm của công đoạn đang mở. */
  stageWorkerName: string | null;
  lastNote: string | null;
}

export interface CaseWorkshopBoardResponse {
  items: CaseWorkshopBoardItem[];
  pagination: PaginationMeta;
}
