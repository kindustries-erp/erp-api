import { IsOptional, IsString, IsInt, IsEnum, IsIn } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export enum InvoicePartnerType {
  CUSTOMER = 'CUSTOMER',
  SUPPLIER = 'SUPPLIER',
}

export class GetInvoiceDebtsQueryDto {
  @ApiPropertyOptional({
    enum: InvoicePartnerType,
    description:
      'Loại đối tác: CUSTOMER (Khách hàng) | SUPPLIER (Nhà cung cấp)',
    default: InvoicePartnerType.CUSTOMER,
  })
  @IsOptional()
  @IsEnum(InvoicePartnerType)
  partner_type?: InvoicePartnerType = InvoicePartnerType.CUSTOMER;

  @ApiPropertyOptional({ description: 'Trang hiện tại (1-based)', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Số dòng trên mỗi trang', default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  pageSize?: number = 20;

  @ApiPropertyOptional({ description: 'Từ khóa tìm kiếm chung (MST hoặc Tên)' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Từ ngày hóa đơn (YYYY-MM-DD)' })
  @IsOptional()
  @IsString()
  date_from?: string;

  @ApiPropertyOptional({ description: 'Đến ngày hóa đơn (YYYY-MM-DD)' })
  @IsOptional()
  @IsString()
  date_to?: string;

  @ApiPropertyOptional({ description: 'Lọc theo chi nhánh (branch_id)' })
  @IsOptional()
  @IsString()
  branch_id?: string;

  @ApiPropertyOptional({ description: 'Cột cần sắp xếp' })
  @IsOptional()
  @IsString()
  sortBy?: string;

  @ApiPropertyOptional({ enum: ['ASC', 'DESC'], description: 'Chiều sắp xếp' })
  @IsOptional()
  @IsIn(['ASC', 'DESC'])
  sortOrder?: 'ASC' | 'DESC' = 'DESC';

  @ApiPropertyOptional({ description: 'JSON string tìm kiếm theo cột' })
  @IsOptional()
  @IsString()
  column_search?: string;

  @ApiPropertyOptional({ description: 'JSON string lọc theo giá trị cột' })
  @IsOptional()
  @IsString()
  column_filters?: string;
}

export class GetInvoiceDebtColumnOptionsQueryDto {
  @ApiPropertyOptional({ enum: InvoicePartnerType })
  @IsOptional()
  @IsEnum(InvoicePartnerType)
  partner_type?: InvoicePartnerType = InvoicePartnerType.CUSTOMER;

  @ApiPropertyOptional({ description: 'Tên cột cần lấy danh sách options' })
  @IsString()
  column_key: string;

  @ApiPropertyOptional({ description: 'Từ khóa tìm kiếm options' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Trang options (1-based)', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Số lượng options trên mỗi trang',
    default: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  pageSize?: number = 20;

  @ApiPropertyOptional({ description: 'JSON string các bộ lọc hiện tại' })
  @IsOptional()
  @IsString()
  filters?: string;

  @ApiPropertyOptional({ description: 'Từ ngày (YYYY-MM-DD)' })
  @IsOptional()
  @IsString()
  date_from?: string;

  @ApiPropertyOptional({ description: 'Đến ngày (YYYY-MM-DD)' })
  @IsOptional()
  @IsString()
  date_to?: string;

  @ApiPropertyOptional({ description: 'Chi nhánh' })
  @IsOptional()
  @IsString()
  branch_id?: string;
}
