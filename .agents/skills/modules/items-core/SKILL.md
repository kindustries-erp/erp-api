---
name: items-core
description: Lõi v2 danh mục mã hàng (src/v2/core/items-core): entity nền, hàm mã và khớp thuần, khung AbstractItemMatchService và cổng ItemCatalogPort. Đọc trước khi tạo biến thể danh mục mới (items-erp, items-vinfast) hoặc cho module mua hàng/kho gọi danh mục.
---

# 🏷️ Lõi Tri Thức: Danh mục mã hàng (`items-core`)

## 1. Vai trò
- **Build kit**, không route, không bảng, không `@Entity` (qua `plop-helpers/apiCoreLayout.test.mjs`). API thật nằm ở module biến thể (`items-garage`).
- Manifest `core.manifest.json` style `v2-core`; barrel `@/v2/core/items-core`.

## 2. Thành phần
| File | Nội dung |
| :--- | :--- |
| `contracts/item-catalog.contract.ts` | `ITEM_SOURCES` (`SEED \| AI \| MANUAL`), `ItemLookupLine`, `ItemMatch<TItem, TType>`, `ItemCatalogKit` (nhóm hàng + nhóm mặc định), cổng `ItemCatalogPort { match, ensureItems }` |
| `entities/base-item.entity.ts` | `BaseItemEntity` (abstract, kế thừa `CoreSoftDeletableEntity`): `itemCode`, `itemName`, `nameNormalized`, `unit`, `itemType`, `source`, `isActive`. Biến thể tự khai báo `@Entity` và index |
| `helpers/item-code.helper.ts` | Hàm thuần nhận danh sách nhóm hàng qua tham số: `normalizeItemCode`, `toItemType`, `itemTypeOfCode`, `withTypePrefix`, `codeCandidates`, `formatSequenceCode`, `sequencePattern` |
| `helpers/item-match.helper.ts` | `collectLookupKeys`, `resolveMatches` (theo mã trước, rồi tên không dấu) |
| `services/abstract-item-match.service.ts` | `AbstractItemMatchService<TItem, TType>` implements `ItemCatalogPort`; constructor `(repo, { entity, types, defaultType, lockKey })`. Tên bảng lấy từ metadata entity |

## 3. Ai dùng
- **Kế thừa**: mỗi biến thể là một module `items-*` có entity kế thừa `BaseItemEntity` và service kế thừa `AbstractItemMatchService`. Hiện có `items-garage`. Ứng viên sau này (chưa là v2, chỉ làm khi có lệnh): `items-erp` (`erp_inventory_items`, có cột riêng FK đơn vị/nhóm), `items-vinfast` (`vinfast_parts_catalog`).
- **Tiêu thụ qua cổng**: lõi và module mua hàng/kho (`procurement-*`, `goods-receipts-*`, `inventory-movements-*`) không import module biến thể trong lõi; chúng nhận `ItemCatalogPort` của biến thể tương ứng. Hiện chỉ `ai-hub-garage` dùng; mua/nhận hàng/kho chưa nối.

## 4. Tạo biến thể mới
1. Entity: `class XItem extends BaseItemEntity` + `@Entity('items_x')` + unique partial index trên `itemCode` (`"is_deleted" = false`).
2. Hằng số nhóm hàng và `defaultType` của biến thể.
3. Service: `extends AbstractItemMatchService`, `super(repo, { entity, types, defaultType, lockKey: 'items_x:ensure' })`.
4. Module cung cấp token cổng (`{ provide: X_ITEM_CATALOG, useExisting: XItemMatchService }`) và export token.

## 5. Lưu ý
- `ensureItems` phải gọi trong transaction (khóa `pg_advisory_xact_lock` giữ tới commit).
- Mã sinh số dùng `SELECT MAX(...)` trên bảng của entity; mã gốc từ chứng từ được gắn tiền tố nhóm, không đổi mã đã có tiền tố chuẩn.
- Không thêm `@Entity`, `@Controller`, service tiêm repository cụ thể vào lõi này.
