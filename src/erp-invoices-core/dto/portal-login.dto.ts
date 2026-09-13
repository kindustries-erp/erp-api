import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class PortalLoginDto {
  @ApiProperty({
    description: 'Tên đăng nhập hoặc Mã số thuế của doanh nghiệp',
  })
  @IsString()
  @IsNotEmpty()
  username: string;

  @ApiProperty({ description: 'Mật khẩu đăng nhập Cổng thuế', required: false })
  @IsString()
  @IsOptional()
  password?: string;

  @ApiProperty({ description: 'Mã Captcha do người dùng nhập' })
  @IsString()
  @IsNotEmpty()
  cvalue: string;

  @ApiProperty({ description: 'Key của mã Captcha tương ứng' })
  @IsString()
  @IsNotEmpty()
  ckey: string;
}
