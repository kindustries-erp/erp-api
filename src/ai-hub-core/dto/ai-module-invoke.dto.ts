import { IsObject, IsOptional, IsString } from 'class-validator';

export class AiModuleInvokeDto {
  @IsString()
  moduleCode: string; // e.g. 'INVOICE', 'ACCOUNTING', 'PURCHASING', 'INVENTORY', 'COPILOT'

  @IsOptional()
  @IsString()
  templateCode?: string;

  @IsObject()
  payload: Record<string, any>;

  @IsOptional()
  @IsString()
  requestId?: string;
}
