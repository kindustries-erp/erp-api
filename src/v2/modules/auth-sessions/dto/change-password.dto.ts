import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @ApiProperty()
  @IsString()
  @MaxLength(200)
  oldPassword: string;

  @ApiProperty({ minLength: 8, maxLength: 72 })
  @IsString()
  @MinLength(8, { message: 'Mật khẩu mới phải từ 8 ký tự' })
  @MaxLength(72, { message: 'Mật khẩu mới tối đa 72 ký tự' })
  newPassword: string;
}
