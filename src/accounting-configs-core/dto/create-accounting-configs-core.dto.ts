import {
  IsString,
  IsNotEmpty,
  IsUUID,
  IsOptional,
  IsBoolean,
} from 'class-validator';

export class CreateAccountingConfigsCoreDto {
  @IsString()
  @IsNotEmpty()
  moduleName: string;

  @IsString()
  @IsNotEmpty()
  action: string;

  @IsUUID()
  @IsOptional()
  debitAccountId?: string;

  @IsUUID()
  @IsOptional()
  creditAccountId?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
