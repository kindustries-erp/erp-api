import { IsIn, IsOptional, IsString } from 'class-validator';

/** Body tải lại XML hàng loạt (`POST portal/bulk-download-xml`). */
export class BulkDownloadXmlDto {
  @IsOptional() @IsString() token?: string;
  @IsOptional() @IsString() cookies?: string;
  @IsIn(['IN', 'OUT']) direction: 'IN' | 'OUT';
}
