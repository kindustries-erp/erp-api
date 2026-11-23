import { Column, Entity, Index } from 'typeorm';
import { BasePurchaseRequestEntity } from '@/v2/core/procurement-requests-core/entities/base-purchase-request.entity';
import {
  LINK_OVERRIDES_COLUMN,
  LINK_SNAPSHOT_COLUMN,
  type LinkOverrideColumns,
  type OverrideMap,
} from '@/v2/core/link-override-core';

@Entity('proc_requests_garage')
export class GarageProcurementRequest
  extends BasePurchaseRequestEntity
  implements LinkOverrideColumns
{
  @Index()
  @Column({ type: 'uuid', name: 'branch_id', nullable: true })
  branchId: string | null;

  @Column({ type: 'varchar', length: 255, name: 'branch_name', nullable: true })
  branchName: string | null;

  /** Giá trị mới nhất của chi nhánh liên kết (khóa camelCase), do server lập khi chọn/cập nhật. */
  @Column(LINK_SNAPSHOT_COLUMN)
  sourceSnapshot: Record<string, unknown>;

  /** Field liên kết đã sửa cục bộ so với chi nhánh (khóa camelCase → true). */
  @Column(LINK_OVERRIDES_COLUMN)
  overrides: OverrideMap;
}
