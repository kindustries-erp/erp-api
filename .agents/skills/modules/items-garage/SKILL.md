---
name: items-garage
description: Module v2 danh mục mã hàng garage (bảng items_garage, route api/v2/items-garage, resource garage_items), kế thừa lõi items-core. Đọc trước khi sửa danh mục mã hàng garage hoặc cho module garage khác gọi danh mục.
---

# 🏷️ Module Backend Tri Thức: Danh mục mã hàng garage (`items-garage`)

## 1. Tổng quan
- **Module**: `ItemsGarageModule` (`src/v2/modules/items-garage/`), kế thừa lõi `src/v2/core/items-core` (xem skill `items-core`).
- **Entity** `GarageItem extends BaseItemEntity`, bảng `items_garage`; unique `item_code` trong dòng `is_deleted = false`, index `name_normalized`. Dữ liệu ban đầu nạp từ 5 bảng garage bằng migration `20261112150000-create-items-garage.ts`.
- **Nhóm hàng** (`GARAGE_ITEM_TYPES`, cũng là tiền tố mã): `VF` phụ tùng VinFast, `PT` phụ tùng khác (mặc định), `VT` vật tư tiêu hao, `DV` dịch vụ, `CK` chiết khấu, `CCDC` công cụ dụng cụ, `HC` hành chính.

## 2. API (`api/v2/items-garage`, resource `garage_items`)
`GET` (list `{ items, pagination, summaries }`), `GET column-options`, `GET :id`, `POST`, `PATCH :id`, `DELETE :id` (xóa mềm). Mã nhập vào được chuẩn hóa (`normalizeItemCode`), `name_normalized` do server tính.

## 3. Cổng dùng chung cho module garage khác
- `GARAGE_ITEM_CATALOG` (`items-garage.tokens.ts`) là token của `ItemCatalogPort<GarageItem, GarageItemType>`; module export token này, bản cài đặt là `GarageItemMatchService extends AbstractItemMatchService`.
- Dùng: `@Inject(GARAGE_ITEM_CATALOG) private readonly items: GarageItemCatalog` và import module `ItemsGarageModule`. Dùng `import type` cho `GarageItemCatalog` trong tham số decorator.
- Hiện dùng bởi `ai-hub-garage` (`match` khi xem trước, `ensureItems` trong transaction tạo PR).

## 4. Chưa nối (ghi nhận 2026-11-12)
- `procurement-requests-garage`, `goods-receipts-garage`, `procurement-flow-garage` (stock adapter) và `inventory-movements-garage-*` vẫn nhận diện hàng bằng chuỗi `item_code`, chưa kiểm tra danh mục. Nối sẽ đổi hành vi nhập liệu, cần plan riêng (chế độ đã chốt: tự tạo mã, `source = MANUAL`, không chặn).
- Số liệu dữ liệu cũ trên `erp_greenway_staging`: nhiều dòng chứng từ không có mã (`proc_request_lines_garage` 231/340, `proc_order_lines_garage` 103/284, `goods_receipt_lines_garage` 10/97), nên không gom được theo danh mục.

## 5. Lưu ý
- Không đổi tên bảng/route/resource khi chưa có lệnh (kèm migration đổi tên bảng và quyền đã seed).
- Controller/DTO/query/command sinh từ plop `api-module-v2`; `garage-item-query.service.ts` 181 dòng (vượt nhẹ ngưỡng 180 của file nguồn).
