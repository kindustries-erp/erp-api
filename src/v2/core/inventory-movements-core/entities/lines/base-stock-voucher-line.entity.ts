import { Column } from 'typeorm';
import { CoreBaseEntity } from '../../../base-core/entities/core-base.entity';

/**
 * Dòng nền của chứng từ kho. Module con extend, thêm khóa ngoại tới header và @Entity(...).
 * `direction` luôn được ghi khi tạo dòng (IN/OUT): với nhập và xuất là cố định, với điều chỉnh lấy từ đầu vào.
 * Kế thừa id và extraData từ lớp nền chung (dòng không có timestamp).
 */
export abstract class BaseStockVoucherLineEntity extends CoreBaseEntity {
  @Column({ type: 'int', name: 'line_no' })
  lineNo: number;

  @Column({ type: 'varchar', length: 128, name: 'item_code' })
  itemCode: string;

  @Column({ type: 'varchar', length: 255, name: 'item_name' })
  itemName: string;

  @Column({ type: 'varchar', length: 50, name: 'unit', default: 'Cái' })
  unit: string;

  @Column({ type: 'numeric', precision: 18, scale: 3, name: 'qty' })
  qty: string;

  /** Nhập: giá nhập. Xuất: giá vốn sau khi ghi sổ (trống khi còn nháp). */
  @Column({
    type: 'numeric',
    precision: 18,
    scale: 2,
    name: 'unit_cost',
    nullable: true,
  })
  unitCost: string | null;

  @Column({
    type: 'numeric',
    precision: 18,
    scale: 2,
    name: 'amount',
    default: 0,
  })
  amount: string;

  @Column({ type: 'varchar', length: 3, name: 'direction' })
  direction: 'IN' | 'OUT';

  @Column({ type: 'text', name: 'notes', nullable: true })
  notes: string | null;
}
