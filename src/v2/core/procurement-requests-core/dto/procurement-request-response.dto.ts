import { ApiProperty } from '@nestjs/swagger';

export class PurchaseRequestLineResponseDto {
  @ApiProperty() id: string;
  @ApiProperty({ type: 'object', additionalProperties: true })
  extraData: Record<string, unknown>;
  @ApiProperty() lineNo: number;
  @ApiProperty({ enum: ['GOODS', 'SERVICE'] }) lineType: 'GOODS' | 'SERVICE';
  @ApiProperty({ nullable: true }) itemId: string | null;
  @ApiProperty({ nullable: true }) itemCode: string | null;
  @ApiProperty({ nullable: true }) itemName: string | null;
  @ApiProperty({ nullable: true }) description: string | null;
  @ApiProperty() qtyRequested: number;
  @ApiProperty() qtyOrdered: number;
  @ApiProperty({ nullable: true }) estUnitPrice: number | null;
  @ApiProperty({ nullable: true }) estAmount: number | null;
  @ApiProperty({ nullable: true }) notes: string | null;
}

export class PurchaseRequestResponseDto {
  @ApiProperty() id: string;
  @ApiProperty({ type: 'object', additionalProperties: true })
  extraData: Record<string, unknown>;
  @ApiProperty() requestNo: string;
  @ApiProperty() requestDate: string;
  @ApiProperty({ nullable: true }) neededDate: string | null;
  @ApiProperty({ nullable: true }) title: string | null;
  @ApiProperty({ nullable: true }) requesterEmployeeId: string | null;
  @ApiProperty() status: string;
  @ApiProperty() orderingStatus: string;
  @ApiProperty() estimatedTotal: number;
  @ApiProperty({ nullable: true }) remarks: string | null;
  @ApiProperty({ nullable: true, description: 'Email người tạo' })
  createdByEmail: string | null;
  @ApiProperty({ nullable: true }) submittedBy: string | null;
  @ApiProperty({ nullable: true }) approvedBy: string | null;
  @ApiProperty({ nullable: true }) approverId: string | null;
  @ApiProperty({
    nullable: true,
    description: 'Email người duyệt (đã duyệt, chưa duyệt thì người được giao)',
  })
  approverEmail: string | null;
  @ApiProperty({ nullable: true }) rejectedBy: string | null;
  @ApiProperty({ nullable: true }) rejectReason: string | null;
  @ApiProperty({ nullable: true }) cancelReason: string | null;
  @ApiProperty({ nullable: true }) closeReason: string | null;
  @ApiProperty({ type: [PurchaseRequestLineResponseDto] })
  lines: PurchaseRequestLineResponseDto[];
}

/** Một dòng gợi ý khi tạo PO từ PR: phần số lượng còn lại chưa đặt. */
export class PurchaseRequestPoDraftLineDto {
  @ApiProperty() requestLineId: string;
  @ApiProperty() lineNo: number;
  @ApiProperty({ enum: ['GOODS', 'SERVICE'] }) lineType: 'GOODS' | 'SERVICE';
  @ApiProperty({ nullable: true }) itemId: string | null;
  @ApiProperty({ nullable: true }) itemCode: string | null;
  @ApiProperty({ nullable: true }) itemName: string | null;
  @ApiProperty({ nullable: true }) description: string | null;
  @ApiProperty() qtyRemaining: number;
  @ApiProperty({ nullable: true }) estUnitPrice: number | null;
}

/** Bản nháp PO điền sẵn từ PR đã duyệt. Chỉ đọc, chưa tạo gì trong DB. */
export class PurchaseRequestPoDraftDto {
  @ApiProperty() requestId: string;
  @ApiProperty() requestNo: string;
  @ApiProperty({ type: [PurchaseRequestPoDraftLineDto] })
  lines: PurchaseRequestPoDraftLineDto[];
}
