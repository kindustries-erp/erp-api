import { IsString, MinLength } from 'class-validator';

export class RefreshTokenDto {
  @IsString()
  @MinLength(1, { message: 'Refresh token không được để trống' })
  refresh_token: string;
}
