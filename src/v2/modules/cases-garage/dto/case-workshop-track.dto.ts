import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { CaseOrigin, CaseStatus } from '../entities/case-garage.enums';

/** Tìm xe để đưa vào bảng tiến độ: theo biển số (bỏ dấu cách, gạch, chấm), mã vụ việc, tên khách. */
export class QueryWorkshopCandidatesDto {
  @ApiProperty({ minLength: 2, maxLength: 50 })
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  search: string;

  @ApiPropertyOptional({ maximum: 50, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;
}

/**
 * Đưa xe có sẵn vào bảng. `status` bỏ trống hoặc trùng là giữ nguyên trạng thái; khác thì đổi
 * (xe KGara ghi đè ở v2, xe NATIVE theo bảng chuyển trạng thái) và cần thêm quyền `garage:update`.
 */
export class TrackWorkshopCaseDto {
  @ApiProperty() @IsUUID() caseId: string;

  @ApiPropertyOptional({ enum: CaseStatus })
  @IsOptional()
  @IsEnum(CaseStatus)
  status?: CaseStatus;
}

/** Xe chưa có vụ việc: tạo vụ việc NATIVE (chỉ bắt buộc biển số) rồi đưa vào bảng. Cần `garage:create`. */
export class TrackNewWorkshopCaseDto {
  @ApiProperty({ maxLength: 50 })
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  licensePlate: string;

  @ApiPropertyOptional({ maxLength: 255 })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  customerName?: string;

  @ApiPropertyOptional({ maxLength: 2000 })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  requestDescription?: string;

  @ApiPropertyOptional({ enum: CaseStatus, default: CaseStatus.INTAKE })
  @IsOptional()
  @IsEnum(CaseStatus)
  status?: CaseStatus;
}

/** Một xe ứng viên trong hộp thoại "Thêm xe vào bảng". */
export interface CaseWorkshopCandidate {
  id: string;
  caseCode: string;
  licensePlate: string | null;
  customerName: string | null;
  voucherCustomerName: string | null;
  vehicleName: string | null;
  origin: CaseOrigin;
  status: CaseStatus;
  receivedAt: string | null;
  /** Đã có trên bảng tiến độ. */
  onBoard: boolean;
}

export interface CaseWorkshopTrackResult {
  caseId: string;
  caseCode: string;
  licensePlate: string | null;
  status: CaseStatus;
  workshopTrackedAt: string;
  /** Trạng thái đã đổi khi đưa vào bảng. */
  statusChanged: boolean;
  /** Vụ việc vừa được tạo mới (xe chưa có trong hệ thống). */
  created: boolean;
}
