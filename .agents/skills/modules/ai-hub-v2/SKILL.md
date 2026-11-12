---
name: ai-hub-v2
description: Tri thức AI Hub v2 trong erp-api (lõi v2/core/ai-hub-core, module ai-hub-gateway gọi 9router theo tier, items-core + items-garage là danh mục mã hàng garage dùng chung, ai-hub-garage đọc ảnh/PDF hóa đơn và tạo đề nghị mua nháp). Đọc trước khi sửa các thư mục này hoặc thêm tính năng AI mới theo chuẩn v2.
---

# AI Hub v2 (erp-api)

## 1. Phạm vi và nguyên tắc

- **V2 thuần**: không import từ `src/ai-hub-core` (v1), `src/erp-invoices-core`, `src/inventory-core`. V1 vẫn chạy riêng cho hóa đơn và captcha.
- **Model theo tier**: code chỉ gọi `tier` (`low | medium | high | ultra`). Tên model nằm trong env `NINE_ROUTER_TIER_MODELS` (JSON). Không hard-code tên model, không dùng `NINE_ROUTER_VISION_MODEL`.
- 9router không có tool-calling: "agent" là pipeline cố định trong code (đọc tài liệu ra JSON, đối chiếu, xem trước, xác nhận, ghi DB).

## 2. Cấu trúc

| Thư mục | Vai trò |
| :--- | :--- |
| `src/v2/core/ai-hub-core/` | Lõi, không gọi mạng, không bảng. Contract (`AiTier`, `AiGatewayPort`, `AiCompletionRequest`, `AiDocumentFile`), helper thuần (`parseTierModels`, `resolveTier`, `buildVisionMessages`, `parseAiJson`, `toAiNumber`, `toAiText`), `AbstractAiDocumentAgentService<T>` |
| `src/v2/modules/ai-hub-gateway/` | `AiGatewayClient` (implements `AiGatewayPort`), `AiUsageLogService`, `AiGatewayHealthService`; bảng `ai_hub_usage_logs` |
| `src/v2/core/items-core/` | Lõi danh mục mã hàng (xem skill `items-core`): `BaseItemEntity`, hàm mã/khớp thuần, `AbstractItemMatchService`, cổng `ItemCatalogPort` |
| `src/v2/modules/items-garage/` | Danh mục mã hàng garage, bảng `items_garage`; `GarageItemMatchService` kế thừa lõi, export token `GARAGE_ITEM_CATALOG` (xem skill `items-garage`) |
| `src/v2/modules/ai-hub-garage/` | Trợ lý hóa đơn garage: xem trước và tạo đề nghị mua |
| `src/v2/core/base-core/helpers/text-normalize.util.ts` | `normalizeVietnamese` (bỏ dấu, chữ thường) dùng chung v2 |

## 3. Env

| Biến | Ý nghĩa |
| :--- | :--- |
| `NINE_ROUTER_BASE_URL`, `NINE_ROUTER_API_KEY` | Địa chỉ và khóa 9router |
| `NINE_ROUTER_TIER_MODELS` | JSON tier → model. Mỗi tier nhận một chuỗi hoặc một mảng model dự phòng theo thứ tự ưu tiên, vd `{"low":["a","b"]}`. Thiếu tier đang gọi: trả 503 nêu tên tier |
| `NINE_ROUTER_TIMEOUT_MS` (30000), `NINE_ROUTER_MAX_RETRIES` (2) | Timeout mặc định mỗi lần gọi, số lần thử lại lỗi tức thời (429, 502, lỗi mạng) |
| `AI_HUB_GARAGE_INVOICE_TIMEOUT_MS` (120000) | Timeout riêng cho đọc hóa đơn. Proxy trước 9router tự cắt ở khoảng 90 giây (trả 504) |
| `AI_HUB_GARAGE_INVOICE_TIER` | Tier đọc hóa đơn garage. Mặc định `low`; giá trị không phải tên tier thì quay về `low` |

## 4. API

| Endpoint | Quyền | Ghi chú |
| :--- | :--- | :--- |
| `POST /api/v2/ai-hub-garage/invoice-preview` | `ai_hub_garage:create` | multipart `file` (JPG/PNG/WEBP/PDF, tối đa 10MB, kiểm tra chữ ký file). Không ghi DB nghiệp vụ. Trả `{ invoice, lines[], warnings[], ai }` |
| `POST /api/v2/ai-hub-garage/purchase-requests` | `ai_hub_garage:create` **và** `garage_procurement_requests:create` | Tạo mã hàng thiếu + PR `DRAFT` trong một transaction. Trả `{ requestId, requestNo, createdItems[] }` |
| `GET /api/v2/items-garage` (+ `column-options`, `:id`), `POST`, `PATCH :id`, `DELETE :id` | `garage_items:*` | CRUD danh mục; list trả `{ items, pagination, summaries }` |
| `GET /api/v2/ai-hub-gateway/health`, `usage-logs`, `usage-logs/column-options`, `usage-logs/:id` | `ai_hub_gateway:read` | Chỉ đọc. Không cấp sẵn cho role nào ngoài `*` |

`warnings` là mã: `SKIPPED_LINES`, `MISSING_UNIT_PRICE`, `TOTAL_MISMATCH` (tổng dòng lệch quá 15% so với tổng hóa đơn).

## 5. Mã hàng garage

- Bảng `items_garage`: `item_code` (unique trong dòng chưa xóa mềm), `item_name`, `name_normalized` (server tự tính), `unit`, `item_type`, `source` (`SEED | AI | MANUAL`), `is_active`.
- Nhóm hàng cũng là tiền tố mã: `VF` phụ tùng VinFast, `PT` phụ tùng khác, `VT` vật tư tiêu hao, `DV` dịch vụ, `CK` chiết khấu, `CCDC` công cụ dụng cụ, `HC` hành chính.
- `ai-hub-garage` tiêm cổng bằng `@Inject(GARAGE_ITEM_CATALOG)`, không import service cụ thể.
- `GarageItemMatchService.match(lines)`: một query cho cả lô; khớp theo mã (kể cả mã đã lưu kèm tiền tố) trước, rồi tới tên không dấu.
- `ensureItems(lines, manager)`: phải gọi trong transaction. Khóa `pg_advisory_xact_lock`, tra lại danh mục, tạo mã thiếu. Chứng từ có mã gốc: `<TIỀN TỐ>-<MÃ GỐC>`. Không có: `<TIỀN TỐ>-<6 số>` tăng dần theo nhóm. Hai dòng cùng tên trong một lô chỉ tạo một mã.
- Dòng `DV` vào PR với `lineType = SERVICE`, còn lại `GOODS`. Đơn vị tính lưu ở `extraData.unit` của dòng PR. Header PR có `extraData.source = 'AI_INVOICE'`, kèm `invoiceNo`, `sellerName`.

## 6. Usage log

`AiGatewayClient.complete` tự ghi một dòng `ai_hub_usage_logs` cho mỗi lần gọi (thành công lẫn lỗi): `feature_code`, `tier`, `model_name`, token, `latency_ms`, `outcome`, `error_message`. `extra_data` chỉ chứa tên file, loại, kích thước; không ghi nội dung tài liệu. Lỗi ghi log không làm hỏng lần gọi AI.

## 7. Thêm tính năng AI mới

1. Tạo module `src/v2/modules/ai-hub-<biến thể>/`, import `AiHubGatewayModule`.
2. Viết service kế thừa `AbstractAiDocumentAgentService<T>`: khai báo `featureCode`, prompt, `resolveTier()` (đọc env riêng), `normalize()`.
3. Thêm resource RBAC riêng và migration seed quyền.

## 8. Migration

- `20261112150000-create-items-garage.ts`: tạo bảng, nạp mã từ `garage_stock_balances`, `inventory_balances_garage`, `goods_receipt_lines_garage`, `proc_order_lines_garage`, `proc_request_lines_garage`.
- `20261112150100-create-ai-hub-usage-logs.ts`.
- `20261112150200-seed-ai-hub-garage-permissions.ts`: `garage_items` (CRUD) và `ai_hub_garage:create` theo role đang có quyền trên `garage_procurement_requests`.

## 9. Hành vi gọi 9router (đo ngày 2026-11-12)

- Phải gửi `stream: false`: 9router mặc định trả `text/event-stream`. Response 2xx không phải JSON bị coi là lỗi.
- Đọc một PDF nhỏ ở tier `low` mất khoảng 56 giây; "ping" mất 3 đến 4 giây. PDF gửi được dạng data URL trong `image_url`.
- Nhà cung cấp chập chờn: có lúc trả `503 No capacity available` sau khoảng 40 giây, có lúc treo tới khi proxy trả 504 ở giây 90.
- Không thử lại cùng model sau timeout, 503, 500, 504 (đã chờ lâu hoặc không tự hết). Chỉ thử lại 429, 502 và lỗi mạng.
- Lỗi do model/nhà cung cấp (5xx, 429, timeout, mạng) thì chuyển sang model kế của tier nếu có. Lỗi 4xx khác (sai key, sai request) dừng ngay.
- Thông báo lỗi trả về gồm tier, model và lý do gốc đã rút gọn; usage log ghi model cuối đã thử.

## 10. Lưu ý

- Template plop `api-module-v2` còn sinh `findAll` dạng `{ total, page, totalPages }` và `{ items: [], total: 0, next: null }`; hai module ở đây đã sửa tay sang `toPaginatedResult` và `emptyOptionsPage`. Sinh module mới cần sửa tương tự cho tới khi template được cập nhật.
- Web gọi các API này qua `src/v2/core/ai-hub` (erp-web), xem skill `ai-hub` của erp-web.
