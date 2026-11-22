import { IsOptional, IsString } from 'class-validator';

/** DTO tạo mới nền họ procurement-orders. Module con extend để thêm trường nghiệp vụ. */
export class BaseCreateProcurementOrderDto {
  @IsOptional()
  @IsString()
  notes?: string;
}
