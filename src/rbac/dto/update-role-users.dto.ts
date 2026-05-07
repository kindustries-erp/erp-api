import { IsArray, IsString } from 'class-validator';

export class UpdateRoleUsersDto {
  @IsArray()
  @IsString({ each: true })
  userIds: string[];
}
