import { ApiProperty } from '@nestjs/swagger';

export class BasePurchaseOrderLineResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() lineNo: number;
  @ApiProperty({ nullable: true }) itemId: string | null;
  @ApiProperty({ nullable: true }) itemCode: string | null;
  @ApiProperty({ nullable: true }) itemName: string | null;
  @ApiProperty({ nullable: true }) description: string | null;
  @ApiProperty({ description: 'Chuỗi số, khớp v1' }) qtyOrdered: string;
  @ApiProperty({ description: 'Chuỗi số, khớp v1' }) qtyReceived: string;
  @ApiProperty({ nullable: true }) unitPrice: string | null;
  @ApiProperty({ nullable: true }) amount: string | null;
}

export class BasePurchaseOrderResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() poNo: string;
  @ApiProperty({ nullable: true }) supplierId: string | null;
  @ApiProperty({ nullable: true }) supplierName: string | null;
  @ApiProperty() orderDate: Date;
  @ApiProperty({ nullable: true }) expectedDate: Date | null;
  @ApiProperty() status: string;
  @ApiProperty() paymentStatus: string;
  @ApiProperty({ nullable: true }) remarks: string | null;
  @ApiProperty({ nullable: true }) supplierInvoiceNo: string | null;
  @ApiProperty({ nullable: true }) createdBy: string | null;
  @ApiProperty() totalAmount: number;
  @ApiProperty({ enum: ['NOT_RECEIVED', 'PARTIAL_RECEIVED', 'RECEIVED'] })
  inventoryStatus: string;
  @ApiProperty() createdAt: Date;
  @ApiProperty() updatedAt: Date;
  @ApiProperty({ type: [BasePurchaseOrderLineResponseDto] })
  lines: BasePurchaseOrderLineResponseDto[];
}
