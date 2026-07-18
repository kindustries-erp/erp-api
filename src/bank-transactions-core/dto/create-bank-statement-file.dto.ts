import { IsString, IsOptional, IsUUID } from 'class-validator';

export class CreateBankStatementFileDto {
  @IsUUID()
  branchId: string;

  @IsOptional()
  @IsUUID()
  bankAccountId?: string;

  @IsOptional()
  @IsUUID()
  cashBookId?: string;

  @IsOptional()
  @IsString()
  periodDate?: string;

  @IsUUID()
  fileId: string;

  @IsOptional()
  @IsString()
  note?: string;
}
