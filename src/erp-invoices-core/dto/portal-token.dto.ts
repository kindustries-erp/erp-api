import { IsOptional, IsString, MaxLength } from 'class-validator';

/** Body lưu cấu hình đăng nhập Cổng Thuế (`POST portal/token`). */
export class PortalTokenDto {
  @IsString() token: string;
  @IsOptional() @IsString() cookies?: string;
  @IsOptional() @IsString() @MaxLength(100) username?: string;
  @IsOptional() @IsString() password?: string;
}
