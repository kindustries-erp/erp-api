import { ApiProperty } from '@nestjs/swagger';
import { PurchaseRequestResponseDto } from '@/v2/core/procurement-requests-core/dto/procurement-request-response.dto';
import { LinkOverrideMetaDto } from '@/v2/core/link-override-core';

/** Response đề nghị mua garage: thêm chi nhánh liên kết và trạng thái override của field liên kết. */
export class GarageProcurementRequestResponseDto
  extends PurchaseRequestResponseDto
  implements LinkOverrideMetaDto
{
  @ApiProperty({ nullable: true, format: 'uuid', description: 'FK chi nhánh' })
  branchId: string | null;

  @ApiProperty({
    nullable: true,
    description: 'Tên chi nhánh hiển thị trên phiếu (sửa cục bộ được)',
  })
  branchName: string | null;

  @ApiProperty({
    type: [String],
    description:
      'Field liên kết đã sửa cục bộ so với chi nhánh (vd: branchName)',
  })
  overriddenFields: string[];

  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    description:
      'Giá trị chi nhánh tại lần lập snapshot gần nhất (vd: branchName)',
  })
  sourceSnapshot: Record<string, unknown>;
}
