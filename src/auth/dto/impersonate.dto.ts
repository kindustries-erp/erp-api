import { IsUUID } from 'class-validator';

export class ImpersonateDto {
  @IsUUID('4', { message: 'target_user_id phải là UUID hợp lệ' })
  target_user_id: string;
}
