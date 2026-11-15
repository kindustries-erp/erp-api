import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty()
  @IsEmail({}, { message: 'Email không hợp lệ' })
  @MaxLength(255)
  email: string;

  @ApiProperty()
  @IsString()
  @MinLength(1, { message: 'Mật khẩu không được để trống' })
  @MaxLength(200)
  password: string;
}
