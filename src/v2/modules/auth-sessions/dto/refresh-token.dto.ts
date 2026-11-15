import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

/** Dùng cho refresh và logout. */
export class RefreshTokenDto {
  @ApiProperty()
  @IsString()
  @MinLength(1, { message: 'Refresh token không được để trống' })
  @MaxLength(512)
  refreshToken: string;
}
