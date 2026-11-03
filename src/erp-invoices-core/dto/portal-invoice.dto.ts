import {
  IsString,
  IsOptional,
  IsIn,
  IsNotEmpty,
  Matches,
} from 'class-validator';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Body đồng bộ hóa đơn từ Cổng Thuế. `dateFrom <= dateTo` được kiểm tra ở service. */
export class PortalFetchDto {
  @IsString() @IsOptional() token?: string;
  @IsString() @IsOptional() cookies?: string;
  @IsString()
  @IsNotEmpty()
  @Matches(ISO_DATE, { message: 'dateFrom phải có định dạng YYYY-MM-DD' })
  dateFrom: string;
  @IsString()
  @IsNotEmpty()
  @Matches(ISO_DATE, { message: 'dateTo phải có định dạng YYYY-MM-DD' })
  dateTo: string;
  @IsString() @IsOptional() @IsIn(['purchase', 'sold']) type?:
    | 'purchase'
    | 'sold';
}
