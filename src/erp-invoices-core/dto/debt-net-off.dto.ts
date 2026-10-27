import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsNumber,
  IsPositive,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { InvoicePartnerType } from './get-invoice-debts.dto';

export class DebtNetOffAllocationDto {
  @ApiProperty({ format: 'uuid', description: 'ID hóa đơn cần cấn trừ' })
  @IsUUID()
  invoiceId: string;

  @ApiProperty({
    description:
      'Số tiền phân bổ cho hóa đơn này (VND, tối đa 2 chữ số thập phân)',
  })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  amount: number;
}

export class DebtNetOffAllocateDto {
  @ApiProperty({
    enum: InvoicePartnerType,
    description:
      'CUSTOMER (thu, hóa đơn bán ra) | SUPPLIER (chi, hóa đơn mua vào)',
  })
  @IsEnum(InvoicePartnerType)
  partnerType: InvoicePartnerType;

  @ApiProperty({ format: 'uuid', description: 'Giao dịch sao kê hoặc sổ quỹ' })
  @IsUUID()
  bankTransactionId: string;

  @ApiProperty({ type: [DebtNetOffAllocationDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => DebtNetOffAllocationDto)
  allocations: DebtNetOffAllocationDto[];
}
