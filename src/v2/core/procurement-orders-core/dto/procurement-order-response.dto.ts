import { ApiProperty } from '@nestjs/swagger';

export class ProcurementOrderLineResponseDto {
  @ApiProperty() id: string;
  @ApiProperty({ type: 'object', additionalProperties: true })
  extraData: Record<string, unknown>;
  @ApiProperty() lineNo: number;
  @ApiProperty({ enum: ['GOODS', 'SERVICE'] }) lineType: 'GOODS' | 'SERVICE';
  @ApiProperty({ nullable: true }) itemId: string | null;
  @ApiProperty({ nullable: true }) itemCode: string | null;
  @ApiProperty({ nullable: true }) itemName: string | null;
  @ApiProperty({ nullable: true }) description: string | null;
  @ApiProperty() qtyOrdered: number;
  @ApiProperty() qtyFulfilled: number;
  @ApiProperty({ nullable: true }) unitPrice: number | null;
  @ApiProperty({ nullable: true }) amount: number | null;
  @ApiProperty({ nullable: true }) requestLineId: string | null;
}

export class ProcurementOrderResponseDto {
  @ApiProperty() id: string;
  @ApiProperty({ type: 'object', additionalProperties: true })
  extraData: Record<string, unknown>;
  @ApiProperty() orderNo: string;
  @ApiProperty() orderDate: string;
  @ApiProperty({ nullable: true }) expectedDate: string | null;
  @ApiProperty({ nullable: true }) supplierId: string | null;
  @ApiProperty({ nullable: true }) supplierName: string | null;
  @ApiProperty({ enum: ['DIRECT', 'REQUEST'] }) sourceType:
    | 'DIRECT'
    | 'REQUEST';
  @ApiProperty({ nullable: true }) requestId: string | null;
  @ApiProperty() status: string;
  @ApiProperty() fulfillmentStatus: string;
  @ApiProperty() totalAmount: number;
  @ApiProperty({ nullable: true }) approvedTotal: number | null;
  @ApiProperty({ nullable: true }) approverId: string | null;
  @ApiProperty({ nullable: true }) remarks: string | null;
  @ApiProperty({ nullable: true }) rejectReason: string | null;
  @ApiProperty({ nullable: true }) cancelReason: string | null;
  @ApiProperty({ nullable: true }) closeReason: string | null;
  @ApiProperty({ type: [ProcurementOrderLineResponseDto] })
  lines: ProcurementOrderLineResponseDto[];
}
