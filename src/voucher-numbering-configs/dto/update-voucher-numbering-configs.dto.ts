import { PartialType } from '@nestjs/swagger';
import { CreateVoucherNumberingConfigsDto } from './create-voucher-numbering-configs.dto';

export class UpdateVoucherNumberingConfigsDto extends PartialType(
  CreateVoucherNumberingConfigsDto,
) {}
