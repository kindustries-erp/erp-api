import { PartialType } from '@nestjs/swagger';
import { CreateInventoryMovementsGarageIssueDto } from './create-inventory-movements-garage-issue.dto';

/** Sửa phiếu nháp: mọi trường tùy chọn; gửi `lines` thì thay toàn bộ dòng. */
export class UpdateInventoryMovementsGarageIssueDto extends PartialType(
  CreateInventoryMovementsGarageIssueDto,
) {}
