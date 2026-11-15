import { ApiProperty } from '@nestjs/swagger';

export class CreatedGarageItemDto {
  @ApiProperty() id: string;
  @ApiProperty() itemCode: string;
  @ApiProperty() itemName: string;
}

export class PrFromInvoiceResponseDto {
  @ApiProperty() requestId: string;
  @ApiProperty() requestNo: string;

  @ApiProperty({
    type: [CreatedGarageItemDto],
    description: 'Mã hàng vừa được tạo mới trong danh mục',
  })
  createdItems: CreatedGarageItemDto[];
}
