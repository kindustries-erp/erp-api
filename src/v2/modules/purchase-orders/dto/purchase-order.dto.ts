import { ApiProperty } from '@nestjs/swagger';
import { ArrayNotEmpty, IsArray, IsUUID } from 'class-validator';
import {
  BaseCreatePurchaseOrderDto,
  BaseNextPurchaseOrderNoQueryDto,
  BaseQueryPurchaseOrderColumnOptionsDto,
  BaseQueryPurchaseOrderDto,
  BaseUpdatePurchaseOrderDto,
} from '@/v2/core/purchase-orders/dto';

/** Tạo PO. Không có status/createdBy: đi qua action và JWT. */
export class CreatePurchaseOrderDto extends BaseCreatePurchaseOrderDto {}

/** Sửa PO. Không nhận status (H3). */
export class UpdatePurchaseOrderDto extends BaseUpdatePurchaseOrderDto {}

/** Danh sách PO. */
export class QueryPurchaseOrdersDto extends BaseQueryPurchaseOrderDto {}

/** Gợi ý giá trị cột của PO. */
export class QueryPurchaseOrderColumnOptionsDto extends BaseQueryPurchaseOrderColumnOptionsDto {}

/** Xem trước số PO kế tiếp. */
export class NextPurchaseOrderNoQueryDto extends BaseNextPurchaseOrderNoQueryDto {}

/** Gắn hóa đơn vào PO (#6: mảng không rỗng, mỗi phần tử là UUID). */
export class LinkInvoicesDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('all', { each: true })
  invoiceIds: string[];
}
