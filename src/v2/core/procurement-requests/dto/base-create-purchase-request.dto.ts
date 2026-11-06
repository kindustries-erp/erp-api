import { IsOptional, IsString } from 'class-validator';

/** DTO tạo mới nền họ procurement-requests. Module con extend để thêm trường nghiệp vụ. */
export class BaseCreatePurchaseRequestDto {
  @IsOptional()
  @IsString()
  notes?: string;
}
