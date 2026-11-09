import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { ExtraDataField } from '@/v2/core/base-core/dto/extra-data.decorator';
import { TableQueryDto } from '@/common/dto/table-query.dto';

export class GarageProcurementRequestLineDto {
  @ApiProperty({ enum: ['GOODS', 'SERVICE'] })
  @IsIn(['GOODS', 'SERVICE'])
  lineType: 'GOODS' | 'SERVICE';

  @ApiPropertyOptional() @IsOptional() @IsUUID() itemId?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(128)
  itemCode?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  itemName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;

  @ApiProperty()
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.001)
  qtyRequested: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  estUnitPrice?: number;

  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;

  @ExtraDataField()
  extraData?: Record<string, unknown>;
}

export class CreateProcurementRequestDto {
  @ApiPropertyOptional({ description: 'Chi nhánh (có thể để trống)' })
  @IsOptional()
  @IsUUID()
  branchId?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  branchName?: string;
  @ApiProperty() @IsDateString() requestDate: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() neededDate?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() requesterEmployeeId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() remarks?: string;

  @ExtraDataField()
  extraData?: Record<string, unknown>;

  @ApiProperty({ type: [GarageProcurementRequestLineDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => GarageProcurementRequestLineDto)
  lines: GarageProcurementRequestLineDto[];
}

export class ReplaceRequestLinesDto {
  @ApiProperty({ type: [GarageProcurementRequestLineDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => GarageProcurementRequestLineDto)
  lines: GarageProcurementRequestLineDto[];
}

export class ListProcurementRequestsDto extends TableQueryDto {
  @ApiPropertyOptional({ description: 'Lọc theo chi nhánh' })
  @IsOptional()
  @IsUUID()
  branchId?: string;

  @ApiPropertyOptional({
    enum: ['only'],
    description:
      'only: chỉ liệt kê đề nghị đã xóa mềm (cần quyền purge để xóa cứng)',
  })
  @IsOptional()
  @IsIn(['only'])
  deleted?: 'only';
}

export class ReasonBodyDto {
  @ApiProperty({ maxLength: 500 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason: string;
}

/** Sửa đầu đề khi còn nháp. Mọi trường tùy chọn; chỉ trường được gửi mới được ghi. Không đổi chi nhánh. */
export class UpdateProcurementRequestHeaderDto {
  @ApiPropertyOptional({
    nullable: true,
    description: 'Chi nhánh (null = bỏ trống). Chỉ khi DRAFT.',
  })
  @IsOptional()
  @IsUUID()
  branchId?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  branchName?: string | null;

  @ApiPropertyOptional() @IsOptional() @IsDateString() requestDate?: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsDateString()
  neededDate?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  remarks?: string | null;

  /** Merge cấp 1 với dữ liệu hiện có; giá trị null xóa key. */
  @ExtraDataField()
  extraData?: Record<string, unknown>;
}
