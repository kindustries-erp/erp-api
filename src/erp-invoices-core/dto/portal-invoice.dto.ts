import {
  IsString,
  IsOptional,
  IsNumber,
  IsIn,
  IsArray,
  ValidateNested,
  IsNotEmpty,
} from 'class-validator';
import { Type } from 'class-transformer';

// DTO cho một hóa đơn khi trả về từ portal (internal mapping)
export class PortalInvoiceDto {
  @IsString() @IsNotEmpty() nbmst: string;
  @IsString() @IsNotEmpty() nbten: string;
  @IsString() @IsOptional() nbdchi?: string; // Địa chỉ người bán
  @IsString() @IsNotEmpty() mst: string; // nmmst - MST người mua
  @IsString() @IsOptional() nmten?: string; // Tên người mua
  @IsString() @IsOptional() nmdchi?: string; // Địa chỉ người mua
  @IsString() @IsNotEmpty() shdon: string;
  @IsString() @IsNotEmpty() khhdon: string;
  @IsNumber() @IsOptional() khmshdon?: number;
  @IsString() @IsNotEmpty() tdlap: string;
  @IsNumber() ttcktmai: number;
  @IsNumber() tgtcthue: number;
  @IsOptional() tsuattue?: number | string;
  @IsNumber() tgtthue: number;
  @IsNumber() tgtttbso: number;
  @IsNumber() tthai: number;
  @IsString() @IsOptional() thdon?: string; // Loại hóa đơn
  @IsOptional() thttltsuat?: { tsuat: string; thtien: number; tthue: number }[];
}

export class PortalFetchDto {
  @IsString() @IsOptional() token?: string;
  @IsString() @IsNotEmpty() dateFrom: string;
  @IsString() @IsNotEmpty() dateTo: string;
  @IsString() @IsOptional() @IsIn(['purchase', 'sold']) type?:
    | 'purchase'
    | 'sold';
}

export class PortalImportDto {
  @IsString() @IsOptional() token?: string;
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PortalInvoiceDto)
  items: PortalInvoiceDto[];
  @IsString() @IsIn(['IN', 'OUT']) direction: 'IN' | 'OUT';
}
