import { CoreHeaderEntity } from '../../base-core/entities/core-header.entity';

/**
 * Entity nền họ inventory-movements-core (chứng từ có vòng đời trạng thái).
 * Module con extend class này, thêm `@Entity(...)` và các cột riêng.
 * Kế thừa id, extraData, timestamps `timestamptz`, isDeleted, status (DRAFT), createdBy từ lớp header chung.
 */
export abstract class BaseStockVoucherEntity extends CoreHeaderEntity {}
