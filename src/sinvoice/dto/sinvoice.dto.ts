import { IsString, IsNotEmpty, IsOptional, IsObject } from 'class-validator';

export class SinvoiceConfigDto {
  @IsString()
  @IsNotEmpty()
  supplierTaxCode: string;

  @IsString()
  @IsNotEmpty()
  username: string;

  @IsString()
  @IsNotEmpty()
  password: string;

  @IsString()
  @IsOptional()
  appKey?: string;

  @IsString()
  @IsNotEmpty()
  apiUrl: string;
}

export class CreateInvoiceDto {
  @IsString()
  @IsNotEmpty()
  templateCode: string;

  @IsString()
  @IsNotEmpty()
  invoiceSeries: string;

  @IsObject()
  @IsNotEmpty()
  invoiceData: any;
}
