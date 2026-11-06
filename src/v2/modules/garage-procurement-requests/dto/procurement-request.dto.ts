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
}

export class CreateProcurementRequestDto {
  @ApiProperty({ description: 'Chi nhánh' }) @IsUUID() branchId: string;
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
}
