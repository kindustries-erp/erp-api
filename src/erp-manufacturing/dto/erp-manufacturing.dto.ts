import {
  IsString,
  IsOptional,
  IsIn,
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsPositive,
  IsDateString,
  IsArray,
  ValidateNested,
  Min,
  IsUUID,
} from 'class-validator';
import { Type } from 'class-transformer';

// ─── Item master ─────────────────────────────────────────────────────────────
export class CreateErpItemDto {
  @IsString() @IsNotEmpty() item_code: string;
  @IsString() @IsNotEmpty() item_name: string;
  @IsOptional() @IsIn(['COMPONENT', 'FINISHED_GOOD']) item_type?: string;
  @IsOptional() @IsIn(['NONE', 'LOT', 'SERIAL']) tracking_type?: string;
  @IsOptional() @IsString() uom?: string;
  @IsOptional() @IsBoolean() is_active?: boolean;
  @IsOptional() @IsString() notes?: string;
}

export class UpdateErpItemDto {
  @IsOptional() @IsString() item_name?: string;
  @IsOptional() @IsIn(['COMPONENT', 'FINISHED_GOOD']) item_type?: string;
  @IsOptional() @IsIn(['NONE', 'LOT', 'SERIAL']) tracking_type?: string;
  @IsOptional() @IsString() uom?: string;
  @IsOptional() @IsBoolean() is_active?: boolean;
  @IsOptional() @IsString() notes?: string;
}

// ─── Purchase Order ───────────────────────────────────────────────────────────
export class ErpPoLineDto {
  @IsUUID() inventory_item_id: string;
  @IsNumber() @IsPositive() ordered_qty: number;
  @IsOptional() @IsNumber() @Min(0) unit_price?: number;
  @IsOptional() @IsString() notes?: string;
}

export class CreateErpPoDto {
  @IsOptional() @IsString() po_no?: string; // auto-generated if omitted
  @IsOptional() @IsUUID() branch_id?: string;
  @IsOptional() @IsUUID() supplier_id?: string;
  @IsOptional() @IsDateString() document_date?: string;
  @IsOptional() @IsDateString() expected_receipt_date?: string;
  @IsOptional() @IsString() notes?: string;
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ErpPoLineDto)
  lines: ErpPoLineDto[];
}

export class UpdateErpPoDto {
  @IsOptional() @IsUUID() branch_id?: string;
  @IsOptional() @IsUUID() supplier_id?: string;
  @IsOptional() @IsDateString() document_date?: string;
  @IsOptional() @IsDateString() expected_receipt_date?: string;
  @IsOptional() @IsString() notes?: string;
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ErpPoLineDto)
  lines?: ErpPoLineDto[];
}

// ─── Receipt ──────────────────────────────────────────────────────────────────
export class ErpReceiptLineDto {
  @IsUUID() purchase_order_line_id: string;
  @IsUUID() inventory_item_id: string;
  @IsIn(['NONE', 'LOT', 'SERIAL']) tracking_type: string;
  @IsNumber() @IsPositive() received_qty: number;
  @IsOptional() @IsNumber() @Min(0) unit_cost?: number;
  @IsOptional() @IsString() lot_code?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) serial_nos?: string[];
  @IsOptional() @IsString() notes?: string;
}

export class CreateErpReceiptDto {
  @IsOptional() @IsString() receipt_no?: string;
  @IsOptional() @IsDateString() receipt_date?: string;
  @IsOptional() @IsString() notes?: string;
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ErpReceiptLineDto)
  lines: ErpReceiptLineDto[];
}

// ─── Vehicle / VIN ────────────────────────────────────────────────────────────
export class CreateErpVehicleDto {
  @IsString() @IsNotEmpty() vin: string;
  @IsString() @IsNotEmpty() frame_no: string;
  @IsString() @IsNotEmpty() engine_no: string;
  @IsOptional() @IsUUID() branch_id?: string;
  @IsOptional() @IsUUID() finished_good_item_id?: string;
  @IsOptional() @IsDateString() assembly_date?: string;
  @IsOptional() @IsString() notes?: string;
}

export class UpdateErpVehicleDto {
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsUUID() branch_id?: string;
  @IsOptional() @IsDateString() assembly_date?: string;
  @IsOptional() @IsString() notes?: string;
}

// ─── Issue ────────────────────────────────────────────────────────────────────
export class ErpIssueLineDto {
  @IsUUID() inventory_item_id: string;
  @IsIn(['NONE', 'LOT', 'SERIAL']) tracking_type: string;
  @IsNumber() @IsPositive() issued_qty: number;
  @IsOptional() @IsNumber() @Min(0) unit_cost?: number;
  @IsOptional() @IsString() lot_code?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) serial_nos?: string[];
  @IsOptional() @IsString() notes?: string;
}

export class CreateErpIssueDto {
  @IsOptional() @IsString() issue_no?: string;
  @IsOptional() @IsDateString() issue_date?: string;
  @IsOptional() @IsString() notes?: string;
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ErpIssueLineDto)
  lines: ErpIssueLineDto[];
}

// ─── Warranty ─────────────────────────────────────────────────────────────────
export class ActivateErpWarrantyDto {
  @IsOptional() @IsString() warranty_code?: string;
  @IsDateString() start_date: string;
  @IsDateString() end_date: string;
  @IsOptional() @IsString() notes?: string;
}

// ─── Query ────────────────────────────────────────────────────────────────────
export class ErpMfgQueryDto {
  @IsOptional() @IsNumber() @Min(1) @Type(() => Number) page?: number;
  @IsOptional() @IsNumber() @Min(1) @Type(() => Number) pageSize?: number;
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsString() branch_id?: string;
  @IsOptional() @IsString() supplier_id?: string;
  @IsOptional() @IsString() tracking_type?: string;
  @IsOptional() @IsString() sort?: string;
}
