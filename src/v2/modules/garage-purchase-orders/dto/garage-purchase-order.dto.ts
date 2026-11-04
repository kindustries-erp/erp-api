import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID } from 'class-validator';
import {
  BaseCreatePurchaseOrderDto,
  BaseQueryPurchaseOrderColumnOptionsDto,
  BaseQueryPurchaseOrderDto,
  BaseUpdatePurchaseOrderDto,
} from '@/v2/core/purchase-orders/dto';

/**
 * Tạo PO garage: lớp nền + chi nhánh và tên NCC lưu thẳng trên phiếu
 * (bảng garage không có quan hệ supplier).
 */
export class CreateGaragePurchaseOrderDto extends BaseCreatePurchaseOrderDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  branchId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  branchName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  supplierName?: string;
}

/** Sửa PO garage. Không nhận status (H3). */
export class UpdateGaragePurchaseOrderDto extends BaseUpdatePurchaseOrderDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  branchId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  branchName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  supplierName?: string;
}

/** Danh sách PO garage: lọc thêm theo chi nhánh. */
export class QueryGaragePurchaseOrdersDto extends BaseQueryPurchaseOrderDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  branch_id?: string;
}

/** Gợi ý giá trị cột của PO garage. */
export class QueryGaragePurchaseOrderColumnOptionsDto extends BaseQueryPurchaseOrderColumnOptionsDto {}
