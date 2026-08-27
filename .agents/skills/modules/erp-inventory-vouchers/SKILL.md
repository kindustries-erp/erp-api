---
name: erp-inventory-vouchers
description: Module tri thức Trung tâm Tra cứu Chứng từ Kho Tổng hợp (Warehouse Vouchers Hub) trong Liouni ERP. Chứa toàn bộ logic truy vấn hợp nhất (Federated query) qua Phiếu Nhập (NK-), Phiếu Xuất (XK-), Phiếu Điều Chỉnh (KK-), bộ lọc đa chiều và xem chi tiết chứng từ.
---

# 📦 Module Tri Thức: Trung Tâm Chứng Từ Kho Tổng Hợp (`erp-inventory-vouchers`)

## 1. Tổng quan Nghiệp vụ

Module `erp-inventory-vouchers` (thuộc `inventory-core`) là **Trung Tâm Tra Cứu Hợp Nhất Mọi Chứng Từ Kho (Unified Warehouse Vouchers Hub)** trong Liouni ERP. Phân hệ này tập hợp toàn bộ các luồng chứng từ phát sinh nhập, xuất, kiểm kê kho từ nhiều phân hệ nghiệp vụ khác nhau vào một màn hình điều hành duy nhất, giúp thủ kho và kế toán kho dễ dàng kiểm soát, đối soát và tra cứu nhanh.

### 1.1. Các tính năng cốt lõi:
- **Truy vấn Hợp nhất Đa nguồn (Federated Multi-Source Query)**:
  - Hợp nhất dữ liệu từ 3 nguồn chứng từ kho chính:
    1. **Phiếu Nhập kho (`RECEIPT`)**: Mã tiền tố `NK-YYYYMMxxxx` (Nhập mua hàng PO, Nhập thành phẩm MO, Nhập trả hàng).
    2. **Phiếu Xuất kho (`ISSUE`)**: Mã tiền tố `XK-YYYYMMxxxx` (Xuất bán hàng SO, Xuất NVL sản xuất MO, Xuất bảo hành).
    3. **Phiếu Điều chỉnh Kiểm kê (`ADJUSTMENT`)**: Mã tiền tố `KK-YYYYMMxxxx` hoặc `DC-YYYYMMxxxx` (Kiểm kê thừa/thiếu).
- **Bộ Lọc Động Đa Cột Phía Máy Chủ (Server-side Column Options & Filtering)**:
  - Endpoint `column-options` tự động trích xuất danh sách giá trị distinct của từng cột trên toàn bộ các bảng chứng từ tham gia (Mã chứng từ, Loại phiếu, Đối tác/Khách hàng/NCC, Trạng thái, Ngày ghi sổ, Số lượng tổng).
- **Xem Chi Tiết Chứng Từ Tức Thời (Voucher Detail Drawer)**:
  - Mở xem chi tiết toàn bộ các dòng mặt hàng (line items), số lượng, đơn giá, mã định danh Serial/VIN đính kèm mà không cần chuyển trang.
- **Chuẩn hóa UI/UX Bảng Chứng Từ Kho (`ErpWarehouseTab.tsx`)**:
  - Cột STT `#` cố định 40px ở đầu bảng, căn giữa.
  - Hàng tổng cộng (`summaryRow`): tự động cộng dồn SL Nhập (`qtyReceipt`), SL Xuất (`qtyIssue`), và SL Điều chỉnh (`qtyAdjustment`).
  - Làm mờ hàng trạng thái phiếu hủy (`CANCELLED`, `VOID`).
  - Action Menu: "Xem chi tiết" (Icon `Eye`), "Xem đơn mua hàng" / "Xem đơn bán hàng" (Icon `FileText`), và "Chỉnh sửa" (Icon `Pencil`, mở thẳng form edit theo loại phiếu). Cột chứng từ dùng `TableText` gọn gàng.

---

## 2. Database Schema & Quan hệ Dữ liệu

Module `erp-inventory-vouchers` thực hiện truy vấn hợp nhất từ các bảng sau:

### 2.1. Các Bảng Tham gia Hợp nhất:

```text
Union Query Hub:
├── erp_goods_receipts (Header Phiếu Nhập) ──< erp_goods_receipt_lines
├── erp_goods_issues (Header Phiếu Xuất)   ──< erp_goods_issue_lines
└── erp_inventory_adjustments (Header KK)   ──< erp_inventory_adjustment_lines
```

| Loại Chứng Từ | Bảng Header | Bảng Line | Mã Tiền Tố | Các trường hiển thị chung |
| :--- | :--- | :--- | :--- | :--- |
| `RECEIPT` | `erp_goods_receipts` | `erp_goods_receipt_lines` | `NK-...` | `voucherNo`, `voucherDate`, `partnerName`, `status`, `totalQty`, `totalAmount` |
| `ISSUE` | `erp_goods_issues` | `erp_goods_issue_lines` | `XK-...` | `voucherNo`, `voucherDate`, `partnerName`, `status`, `totalQty`, `totalAmount` |
| `ADJUSTMENT`| `erp_inventory_adjustments` | `erp_inventory_adjustment_lines`| `KK-...`/`DC-...` | `voucherNo`, `voucherDate`, `remarks`, `status`, `totalQty` |

---

## 3. Cấu trúc Source Code

### 3.1. Backend (`erp-api`)
```text
src/inventory-core/
├── dto/
│   └── warehouse-voucher-query.dto.ts        # DTO nhận filter: page, pageSize, search, type (RECEIPT/ISSUE/ADJUSTMENT), column_filters
├── services/
│   └── inventory-warehouse-voucher.service.ts # Service thực hiện SQL UNION truy vấn hợp nhất chứng từ kho
└── inventory-core.controller.ts              # Endpoints: GET /api/v1/inventory/warehouse-vouchers, column-options
```

### 3.2. Frontend (`erp-web`)
```text
src/
├── pages/
│   ├── inventory/InventoryVouchersPage.tsx   # Trang Trung tâm Chứng từ Kho chính
│   └── ErpWarehouseTab.tsx                   # Tab điều hướng kho và chứng từ
└── modules/inventory-core/components/
    ├── VoucherDetailTable.tsx                # Bảng chi tiết các dòng SKU của chứng từ
    └── inventory-voucher-drawer/             # Drawer xem chi tiết và duyệt chứng từ
```

---

## 4. Danh sách API Endpoints & RBAC Contract

Base Controller: `src/inventory-core/inventory-core.controller.ts`  
Guards: `JwtAuthGuard`, `CoreRbacGuard`

| Method | Endpoint | Quyền yêu cầu | Mô tả |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/inventory/warehouse-vouchers` | `{ resource: 'inventory_items', action: 'read' }` | Lấy danh sách hợp nhất toàn bộ chứng từ Nhập, Xuất, Điều chỉnh (phân trang, search, column filters) |
| `GET` | `/api/v1/inventory/warehouse-vouchers/column-options` | `{ resource: 'inventory_items', action: 'read' }` | Lấy danh sách options distinct cho bộ lọc header từng cột của bảng chứng từ tổng hợp |

---

## 5. Logic Nghiệp vụ & Thuật toán Hợp Nhất SQL

### 5.1. Thuật toán Union Query Hợp nhất
Service `inventory-warehouse-voucher.service.ts` xây dựng câu truy vấn SQL động:
1. Dựa trên param `type` (`ALL`, `RECEIPT`, `ISSUE`, `ADJUSTMENT`):
   - Nếu bao gồm Nhập kho (`includeReceipts`): Query từ `erp_goods_receipts gr` kết nối `business_partners` và subquery `SUM(qty_received)`.
   - Nếu bao gồm Xuất kho (`includeIssues`): Query từ `erp_goods_issues gi` kết nối `business_partners` và subquery `SUM(qty_issued)`.
   - Nếu bao gồm Điều chỉnh (`includeAdjustments`): Query từ `erp_inventory_adjustments ga` và subquery `SUM(qty_adjusted)`.
2. Hợp nhất bằng `UNION ALL`.
3. Áp dụng phân trang (`LIMIT`, `OFFSET`) và sắp xếp theo ngày chứng từ giảm dần (`voucherDate DESC`).

---

## 6. Tích hợp Liên Module

- **`goods-receipts-core`**: Cung cấp dữ liệu Phiếu nhập kho.
- **`goods-issues-core`**: Cung cấp dữ liệu Phiếu xuất kho.
- **`inventory-adjustments-core`**: Cung cấp dữ liệu Phiếu kiểm kê điều chỉnh.
- **`business-partners-core`**: Cung cấp thông tin Nhà cung cấp, Khách hàng hoặc Đại lý liên quan trên phiếu.

---

## 7. Quy tắc Kiểm thử & Báo cáo Chất lượng (QC Mandate)

1. **TypeCheck**: Chạy `bun run check:ci` trong `erp-api/` và `erp-web/`.
2. **Kiểm tra Hiệu năng Query**: Các truy vấn UNION kết hợp subquery tổng hợp phải được tối ưu index trên `receipt_date`, `issue_date`, `adjustment_date` và khóa ngoại `business_partner_id`.
