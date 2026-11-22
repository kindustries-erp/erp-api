/**
 * DTO tạo nền họ inventory-movements-core. Hiện chưa có trường chung nào: mỗi module khai báo trường riêng
 * (số phiếu, ngày, chi nhánh...) trong DTO của mình.
 */
import { ExtraDataField } from '../../base-core/dto/extra-data.decorator';

export class BaseCreateStockVoucherDto {
  @ExtraDataField()
  extraData?: Record<string, unknown>;
}
