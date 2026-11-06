import { PartialType } from '@nestjs/swagger';
import { CreateInventoryMovementsGarageAdjustmentDto } from './create-inventory-movements-garage-adjustment.dto';

/** Sửa phiếu nháp: mọi trường tùy chọn; gửi `lines` thì thay toàn bộ dòng. */
export class UpdateInventoryMovementsGarageAdjustmentDto extends PartialType(
  CreateInventoryMovementsGarageAdjustmentDto,
) {}
