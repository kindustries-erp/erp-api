import { PartialType } from '@nestjs/swagger';
import { CreateInventoryMovementsGarageReceiptDto } from './create-inventory-movements-garage-receipt.dto';

/** Sửa phiếu nháp: mọi trường tùy chọn; gửi `lines` thì thay toàn bộ dòng. */
export class UpdateInventoryMovementsGarageReceiptDto extends PartialType(
  CreateInventoryMovementsGarageReceiptDto,
) {}
