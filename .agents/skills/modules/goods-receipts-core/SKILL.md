---
name: goods-receipts-core
description: Module tri thức Nền tảng Chứng Từ Nhập Kho & Base Voucher Engine V2 (goods-receipts-core) trong erp-api (v2/core/goods-receipts-core). Chứa các hợp đồng chuẩn (IVoucherHeader, IVoucherLine, IStockMovementStrategy), BaseVoucherEngineService (sinh mã tăng dần theo ngày, máy trạng thái DRAFT/POSTED/CANCELLED, tính tổng dòng hàng), và generator PlopJS api-voucher-v2.
---

# 📦 Module Tri Thức: V2 Goods Receipts Core & Base Voucher Engine

## 1. Tổng quan Kiến trúc

Phân hệ `src/v2/core/goods-receipts-core/` đóng vai trò là **Nền tảng Xử lý Chứng từ Dùng Chung (Base Voucher Engine)** cho toàn bộ hệ thống ERP V2. 

Module cung cấp các giải pháp nền tảng cho mô hình **Master-Detail (Header + Detail Lines)**:
- **Base Contracts & Interfaces**: Khung chuẩn cho Header (`IVoucherHeader`), Dòng hàng (`IVoucherLine`), và Chiến lược vận động kho (`IStockMovementStrategy`).
- **Abstract Base Entities**:
  - `BaseGoodsReceiptEntity`: Khai báo sẵn các cột chung của bảng Header (`receiptNo`, `receiptDate`, `supplierId`, `supplierName`, `branchId`, `branchName`, `totalAmount`, `status`, `remarks`, `createdBy`, `isDeleted`, `createdAt`, `updatedAt`).
  - `BaseGoodsReceiptLineEntity`: Khai báo sẵn các cột của dòng hàng (`lineNo`, `itemCode`, `itemName`, `unit`, `qtyReceived`, `unitCost`, `amount`, `notes`, `createdAt`, `updatedAt`).
- **Base DTOs**:
  - `BaseCreateGoodsReceiptDto`, `BaseCreateGoodsReceiptLineDto`
  - `BaseUpdateGoodsReceiptDto`
  - `BaseQueryGoodsReceiptDto`
  - `BaseGoodsReceiptResponseDto`, `BaseGoodsReceiptLineResponseDto`
- **Base Voucher Engine (`BaseVoucherEngineService`)**:
  - `generateDailyVoucherNo`: Thuật toán sinh mã số chứng từ theo định dạng `{prefix}-{YYYYMMDD}-{sequence:000}`.
  - `validateVoucherTransition`: Máy trạng thái chứng từ (`DRAFT` ➔ `POSTED` ➔ `CANCELLED`).
  - `sumLineAmounts`: Tính tổng tiền tự động từ số lượng và đơn giá dòng hàng.
- **Generator Tự Động Hóa (`api-voucher-v2`)**: Công cụ sinh toàn bộ mã nguồn V2 chuẩn cho mọi module dạng chứng từ kế thừa trực tiếp từ Core.

---

## 2. Hợp Đồng Dữ Liệu (Voucher Contracts)

```typescript
export type VoucherStatus = 'DRAFT' | 'POSTED' | 'CANCELLED';

export interface IVoucherLine {
  id?: string;
  lineNo?: number;
  itemCode?: string | null;
  itemName: string;
  unit?: string | null;
  qtyReceived: string | number;
  unitCost: string | number;
  amount: string | number;
  notes?: string | null;
}

export interface IVoucherHeader {
  id?: string;
  receiptNo: string;
  receiptDate: string | Date;
  status: VoucherStatus | string;
  totalAmount?: string | number | null;
  branchId?: string | null;
  supplierId?: string | null;
  supplierName?: string | null;
  remarks?: string | null;
  lines?: IVoucherLine[];
}

export interface IStockMovementStrategy {
  executeMovement(manager: EntityManager, header: IVoucherHeader, lines: IVoucherLine[]): Promise<void>;
  revertMovement(manager: EntityManager, header: IVoucherHeader, lines: IVoucherLine[]): Promise<void>;
}
```

---

## 3. Cách Sử Dụng Trong Domain Modules (vd: Garage Goods Receipts)

Trong module con (domain extension):
1. Import `GoodsReceiptsCoreModule` vào module con.
2. Inject `BaseVoucherEngineService` vào `CommandService`:
   ```typescript
   @Injectable()
   export class GarageGoodsReceiptCommandService {
     constructor(
       private readonly dataSource: DataSource,
       @InjectRepository(GarageGoodsReceipt)
       private readonly repo: Repository<GarageGoodsReceipt>,
       private readonly voucherEngine: BaseVoucherEngineService,
     ) {}

     async generateDailyReceiptNo(orderDate?: string): Promise<string> {
       return this.voucherEngine.generateDailyVoucherNo(this.repo, 'receiptNo', 'GGR', orderDate);
     }
   }
   ```
3. Áp dụng `this.voucherEngine.validateVoucherTransition(...)` tại các hàm `update`, `post`, `cancel`, `softDelete`.

---

## 4. Scaffold Nhanh Bằng PlopJS (`api-voucher-v2`)

Để tạo một module chứng từ mới theo chuẩn V2:
```bash
bunx plop api-voucher-v2
```
Generator tự sinh đầy đủ:
- Header & Line Entities (OneToMany/ManyToOne).
- Create, Update, Query, Response DTOs.
- Two-way Mappers (Header + Lines).
- Query Service (`TableQueryDto`, `computeTableSummaries`, `column-options`).
- Command Service (Transaction, `BaseVoucherEngineService`, post, cancel, softDelete).
- Facade Service (`{ message, data }` envelope).
- Controller với đầy đủ RBAC guards & annotations.
- Toàn bộ co-located unit tests.

