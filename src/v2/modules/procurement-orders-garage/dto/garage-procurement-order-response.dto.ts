import { ApiProperty } from '@nestjs/swagger';
import { ProcurementOrderResponseDto } from '@/v2/core/procurement-orders-core/dto/procurement-order-response.dto';

export class GarageProcurementOrderAcceptanceDto {
  @ApiProperty() id: string;
  @ApiProperty() orderLineId: string;
  @ApiProperty() qty: number;
  @ApiProperty() acceptedAt: Date;
  @ApiProperty({ nullable: true }) note: string | null;
  @ApiProperty() isVoided: boolean;
}

/** Response PO garage: lõi PO cộng các trường riêng của garage. */
export class GarageProcurementOrderResponseDto extends ProcurementOrderResponseDto {
  @ApiProperty({ nullable: true }) branchId: string | null;
  @ApiProperty({ nullable: true }) branchName: string | null;
  @ApiProperty() paymentStatus: string;
  @ApiProperty({ nullable: true }) supplierInvoiceNo: string | null;
  @ApiProperty({ nullable: true }) issuedAt: Date | null;
  @ApiProperty({ type: [GarageProcurementOrderAcceptanceDto] })
  acceptances: GarageProcurementOrderAcceptanceDto[];
}
