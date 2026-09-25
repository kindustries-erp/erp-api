---
name: ai-hub-core
description: Module tri thức AI Hub Core & 9router Gateway Integration trong erp-api (ai-hub-core). Chứa toàn bộ database schema (erp_ai_configs, erp_ai_logs, erp_ai_prompt_templates), DTOs, API endpoints, logic kết nối 9router gateway (https://9router.liouni.com), cơ chế định tuyến theo Tier (low, medium, high, ultra), 5 domain handlers chuyên biệt (Invoice, Accounting, Purchasing, Inventory, Copilot) và token audit logging.
---

# 🤖 Module Tri Thức: AI Hub Core & 9router Gateway - Backend (`erp-api`)

## 1. Tổng quan Nghiệp vụ

Module `ai-hub-core` là cổng trung tâm (Central Gateway & Orchestrator) chịu trách nhiệm kết nối, điều phối và phân bổ các tác vụ trí tuệ nhân tạo (AI) trong toàn bộ hệ thống ERP:

Các nghiệp vụ trọng tâm:
- **Cổng kết nối AI tập trung (`NineRouterClient`)**: Kết nối tới gateway nội bộ `https://9router.liouni.com/v1` (tương thích chuẩn OpenAI API), hỗ trợ timeout tự động, exponential backoff retry, và xử lý streaming/JSON mượt mà.
- **Phân bổ Tier linh hoạt (`Tier Selection`)**: Phân bổ mô hình AI thông minh theo 4 cấp độ:
  - `Tier low` *(Gemini 3.7 Flash Low)*: Tác vụ phân loại nhanh, trích xuất ngắn, chuẩn hóa dữ liệu.
  - `Tier medium` *(Gemini 3.7 Flash Medium)*: Đọc hiểu chứng từ, gợi ý định khoản kế toán, đối chiếu báo giá.
  - `Tier high` *(Gemini 3.7 Flash High)*: Dự báo rủi ro tồn kho, phân tích số liệu tài chính phức tạp.
  - `Tier ultra` *(GPT-6 Astra / Claude Opus)*: Trợ lý điều hành Copilot cao cấp.
- **5 Phân hệ Domain Handlers chuyên biệt**:
  - `InvoiceAiHandler`: Trích xuất dữ liệu hóa đơn tài chính (OCR/Text) thành JSON cấu trúc phục vụ tạo hóa đơn và đối chiếu PO/GRN.
  - `AccountingAiHandler`: Gợi ý tự động cặp tài khoản Nợ/Có (tuân thủ Thông tư 200 & 133 của Bộ Tài chính) kèm độ tin cậy `confidence`.
  - `PurchasingAiHandler`: So sánh đa chiều báo giá các nhà cung cấp, đánh giá rủi ro giao hàng và tối ưu hóa chi phí đơn mua hàng.
  - `InventoryAiHandler`: Phân tích biến động xuất nhập tồn, đánh giá nguy cơ thiếu hàng (stockout) hoặc tồn kho quá hạn (overstock).
  - `CopilotAiHandler`: Trợ lý hội thoại thông minh hỗ trợ giải đáp quy trình, tra cứu dữ liệu và tóm tắt báo cáo.
- **Quản lý Cấu hình & Prompt Động (`ErpAiConfig` & `ErpAiPromptTemplate`)**: Cho phép bật/tắt AI từng phân hệ, đổi Tier/Model override và tinh chỉnh system prompt mà không cần sửa code.
- **Audit Logging & Token Accounting (`ErpAiLog`)**: Tự động lưu vết mọi lượt gọi AI (user, module, tier, model, token tiêu thụ, latency_ms, trạng thái).

---

## 2. Database Schema & Quan hệ Dữ liệu

### 2.1. Bảng `erp_ai_configs` (Cấu hình AI theo Phân hệ)

| Cột | Kiểu dữ liệu | Nullable | Default | Mô tả / Ràng buộc |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `uuid` | NO | `gen_random_uuid()` | Khóa chính (PK) |
| `module_code` | `varchar(64)` | NO | — | Mã phân hệ (`INVOICE`, `ACCOUNTING`, `PURCHASING`, `INVENTORY`, `COPILOT`) - Unique Index |
| `module_name` | `varchar(255)` | NO | — | Tên hiển thị của phân hệ |
| `tier_level` | `varchar(32)` | NO | `'medium'` | Cấp độ Tier mặc định (`low`, `medium`, `high`, `ultra`) |
| `model_override` | `varchar(128)` | YES | `NULL` | Tên model cụ thể ghi đè (nếu muốn bypass tier) |
| `temperature` | `double precision` | NO | `0.2` | Nhiệt độ sáng tạo của model (0.0 - 1.0) |
| `max_tokens` | `integer` | NO | `4096` | Giới hạn token tối đa cho mỗi phản hồi |
| `is_active` | `boolean` | NO | `true` | Trạng thái kích hoạt (Index) |
| `description` | `text` | YES | — | Mô tả chi tiết nghiệp vụ |
| `created_at` | `timestamp` | NO | `now()` | Thời điểm tạo |
| `updated_at` | `timestamp` | NO | `now()` | Thời điểm cập nhật |

### 2.2. Bảng `erp_ai_logs` (Nhật ký Gọi AI & Token Usage)

| Cột | Kiểu dữ liệu | Nullable | Default | Mô tả / Ràng buộc |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `uuid` | NO | `gen_random_uuid()` | Khóa chính (PK) |
| `request_id` | `varchar(128)` | YES | — | Mã định danh request (Correlation ID) |
| `actor_user_id` | `uuid` | YES | — | ID người dùng thực hiện (Index) |
| `actor_email` | `varchar(255)` | YES | — | Email người dùng thực hiện |
| `module_code` | `varchar(64)` | NO | — | Phân hệ phát sinh request (Index) |
| `tier_level` | `varchar(32)` | NO | — | Cấp độ Tier đã sử dụng |
| `model_name` | `varchar(128)` | NO | — | Model thực tế đã xử lý |
| `prompt_snippet` | `text` | YES | — | Trích đoạn nội dung prompt gửi đi |
| `prompt_tokens` | `integer` | NO | `0` | Số lượng prompt token |
| `completion_tokens` | `integer` | NO | `0` | Số lượng completion token |
| `total_tokens` | `integer` | NO | `0` | Tổng token tiêu thụ |
| `latency_ms` | `integer` | NO | `0` | Thời gian phản hồi (ms) |
| `status` | `varchar(32)` | NO | `'SUCCESS'` | Trạng thái (`SUCCESS`, `ERROR`, `TIMEOUT` - Index) |
| `error_message` | `text` | YES | — | Thông báo lỗi nếu thất bại |
| `created_at` | `timestamp` | NO | `now()` | Thời điểm phát sinh log (Index) |

### 2.3. Bảng `erp_ai_prompt_templates` (Quản lý Mẫu Prompt)

| Cột | Kiểu dữ liệu | Nullable | Default | Mô tả / Ràng buộc |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `uuid` | NO | `gen_random_uuid()` | Khóa chính (PK) |
| `template_code` | `varchar(64)` | NO | — | Mã mẫu prompt (`INVOICE_OCR_EXTRACT`, etc.) |
| `module_code` | `varchar(64)` | NO | — | Thuộc phân hệ nào (Index) |
| `version` | `integer` | NO | `1` | Phiên bản prompt |
| `system_prompt` | `text` | NO | — | Câu lệnh định hướng hệ thống (System instruction) |
| `user_prompt_template` | `text` | NO | — | Khuôn mẫu câu lệnh người dùng (hỗ trợ placeholder `{{...}}`) |
| `input_schema_json` | `jsonb` | YES | — | Schema JSON đầu vào mẫu |
| `is_active` | `boolean` | NO | `true` | Trạng thái sử dụng |
| `created_at` | `timestamp` | NO | `now()` | Thời điểm tạo |
| `updated_at` | `timestamp` | NO | `now()` | Thời điểm cập nhật |

---

## 3. Cấu trúc Source Code Backend

```text
src/ai-hub-core/
├── ai-hub-core.module.ts              # NestJS Module đăng ký Providers, Handlers, Controller & Entities
├── ai-hub-core.controller.ts          # Controller cung cấp REST API (/api/v1/ai-hub/*)
├── ai-hub-core.service.ts             # Orchestrator: Quản lý config, tier routing, logging, execute
├── ai-hub-core.service.spec.ts        # Unit test cho AiHubCoreService
├── clients/
│   ├── nine-router.client.ts          # HTTP/SSE Client kết nối 9router gateway (Clean DI: constructor(configService))
│   ├── nine-router.types.ts           # Định nghĩa Types & Interfaces chuẩn OpenAI/9router
│   └── nine-router.client.spec.ts     # Unit test cho NineRouterClient
├── helpers/
│   ├── json-to-toon.helper.ts         # Universal TOON (Token-Oriented Object Notation) Serializer (-50% tokens)
│   └── json-to-toon.helper.spec.ts    # Unit test cho JSON to TOON Serializer (13/13 test cases)
├── entities/
│   ├── erp-ai-config.entity.ts        # Entity bảng erp_ai_configs
│   ├── erp-ai-log.entity.ts           # Entity bảng erp_ai_logs
│   └── erp-ai-prompt-template.entity.ts # Entity bảng erp_ai_prompt_templates
├── dto/
│   ├── ai-chat-completion.dto.ts      # DTO Chat completion trực tiếp
│   ├── ai-module-invoke.dto.ts        # DTO kích hoạt AI theo phân hệ nghiệp vụ
│   ├── update-ai-config.dto.ts        # DTO cập nhật cấu hình phân hệ AI
│   └── create-prompt-template.dto.ts  # DTO tạo/cập nhật prompt template
└── handlers/
    ├── invoice-ai.handler.ts          # Handler Hóa đơn & OCR (hỗ trợ extractInvoiceData & extractLicensePlate với TOON)
    ├── invoice-ai.handler.spec.ts     # Unit test cho InvoiceAiHandler
    ├── accounting-ai.handler.ts       # Handler phân hệ Kế toán & Định khoản tự động
    ├── purchasing-ai.handler.ts       # Handler phân hệ Mua hàng & Báo giá NCC
    ├── inventory-ai.handler.ts        # Handler phân hệ Kho & Rủi ro tồn kho
    └── copilot-ai.handler.ts          # Handler phân hệ Trợ lý Copilot

scripts/
└── backfill-invoice-license-plates.ts # CLI Tool trích xuất & backfill biển số xe cho hóa đơn bán ra (hỗ trợ --dry-run, --branch, --force)
```

---

## 4. Danh sách API Endpoints

Controller Base Route: `/api/ai-hub` (Bảo vệ bởi `JwtAuthGuard`)

| Method | Endpoint | DTO / Body | Mô tả |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/ai-hub/invoke` | `AiModuleInvokeDto` (`moduleCode`, `payload`, `requestId`) | Kích hoạt xử lý AI chuyên biệt cho từng phân hệ nghiệp vụ |
| `POST` | `/api/ai-hub/chat` | `AiChatCompletionDto` (`model`, `tier`, `messages`, `temperature`) | Gửi hội thoại trực tiếp qua 9router gateway |
| `GET` | `/api/ai-hub/configs` | — | Lấy toàn bộ danh sách cấu hình AI các phân hệ |
| `GET` | `/api/ai-hub/configs/:moduleCode` | Params: `moduleCode` | Xem chi tiết cấu hình của một phân hệ |
| `PATCH` | `/api/ai-hub/configs/:moduleCode` | `UpdateAiConfigDto` | Cập nhật Tier, Model Override, nhiệt độ hoặc bật/tắt phân hệ |
| `GET` | `/api/ai-hub/logs` | Query: `limit` | Xem lịch sử gọi AI và token usage |
| `GET` | `/api/ai-hub/health-check` | — | Kiểm tra kết nối và độ trễ tới 9router gateway |

---

## 5. Tích hợp Liên Module & Utilities

- **Universal TOON Serializer (`json-to-toon.helper.ts`)**:
  - Chuyển đổi mọi cấu trúc JSON đa cấp thành định dạng bảng thụt lề TOON (Token-Oriented Object Notation).
  - Giảm **~46% - 52% số lượng tokens** đầu vào so với JSON thô, tăng tốc độ xử lý và độ chính xác trích xuất của LLM.
- **Kế toán & Hóa đơn (`erp-invoices-core`, `accounting-core`)**: Import `AiHubCoreModule` để dùng `InvoiceAiHandler` (trích xuất hóa đơn, bóc tách biển số xe qua TOON) và `AccountingAiHandler` hỗ trợ người dùng nhập liệu tự động.
- **Mua hàng & Kho (`purchase-orders-core`, `inventory-core`)**: Dùng `PurchasingAiHandler` để so sánh giá và `InventoryAiHandler` để phân tích rủi ro tồn kho an toàn.
- **Frontend (`erp-web`)**:
  - Tích hợp các nút hành động ngữ cảnh (Contextual AI Action Buttons).
  - Tích hợp Drawer AI Copilot toàn hệ thống.

---

## 6. Quy tắc Kiểm thử & QC Mandate

Khi chỉnh sửa module `ai-hub-core`:
1. **Chạy Unit Tests**:
   ```bash
   bunx jest src/ai-hub-core/ --forceExit
   ```
2. **Build Kiểm tra Type**:
   ```bash
   bun run type:check
   ```
3. **Kiểm tra Migration Database**:
   - Migration file: `src/migrations/20260925134500-CreateAiHubTables.ts`.

