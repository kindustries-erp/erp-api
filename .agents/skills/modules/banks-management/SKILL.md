---
name: banks-management
description: Tri thức backend cho module Quản lý ngân hàng V2 (banks-management) và lõi base-only banks-core trong erp-api.
---

# Quản lý ngân hàng (banks-management)

## Vị trí và kiến trúc V2

- Lõi họ `src/v2/core/banks-core/` **base-only** (style `v2-core`): `BaseBankEntity` (kế thừa `CoreSoftDeletableEntity`, không mang decorator `@Entity`, không tạo bảng DB riêng), contracts, manifest.
- Module `src/v2/modules/banks-management/` quản lý dữ liệu và API:
  - Entity: `BankManagement` kế thừa `BaseBankEntity`, gắn `@Entity({ name: 'banks_management' })`.
  - Bảng DB: `banks_management` (snake_case `<gốc>_<hậu tố>`, không prefix `erp_`).
  - Index: `UQ_banks_management_code_active` (unique code với `is_deleted = false`), `idx_banks_management_bin`, `idx_banks_management_is_active`.
  - Dịch vụ:
    - `BanksManagementQueryService`: tìm kiếm, lọc theo cột (`TableColumnMap`), phân trang, `findColumnOptions()`.
    - `BanksManagementCommandService`: tạo mới, cập nhật, xóa mềm (`isDeleted = true`).
    - `BanksManagementLogoService`: cache in-memory ảnh logo từ VietQR CDN và trả ảnh PNG kèm CORS/Cache header, SVG placeholder dự phòng.
    - `BanksManagementSyncService`: đồng bộ trực tiếp từ VietQR API (`https://api.vietqr.io/v2/banks`), cập nhật logo và BIN Napas 247 vào DB.
    - `BanksManagementFacade`: gom các sub-services theo chuẩn Clean DI Facade.
  - Controller: `BanksManagementController` (`@Controller('api/v2/banks-management')`).
- Đăng ký: `BanksManagementModule` trong `src/app.module.ts`, `BankManagement` trong `src/db/data-source.ts`.

## Database Schema (`banks_management`)

| Cột | Kiểu | Ghi chú |
| --- | --- | --- |
| `id` | uuid | Primary key, UUIDv4 |
| `code` | varchar(50) | Mã ngân hàng viết tắt (VCB, TCB...) |
| `short_name` | varchar(100) | Tên ngắn (Vietcombank, Techcombank...) |
| `name` | varchar(255) | Tên đầy đủ pháp nhân ngân hàng |
| `bin` | varchar(10) | Mã BIN Napas 6 chữ số (970436...) |
| `logo_url` | varchar(500) | Link ảnh logo ngân hàng (nullable) |
| `aliases` | jsonb | Mảng các tên gọi khác để phục vụ tìm kiếm/khớp tự do |
| `is_active` | boolean | Trạng thái hoạt động (mặc định true) |
| `transfer_supported` | boolean | Có hỗ trợ chuyển khoản nhanh 24/7 Napas |
| `lookup_supported` | boolean | Có hỗ trợ tra cứu số tài khoản |
| `synced_at` | timestamptz | Thời điểm đồng bộ từ VietQR API gần nhất |
| `extra_data` | jsonb | Dữ liệu mở rộng |
| `created_at` / `updated_at` | timestamptz | Thời điểm tạo / cập nhật |
| `is_deleted` | boolean | Cờ xóa mềm (index) |

## HTTP Endpoints (`/api/v2/banks-management`)

Các endpoint CRUD và sync yêu cầu `JwtAuthGuard`. Endpoint `/logo/:code` là public không cần auth token.

| Method | Route | Mô tả |
| --- | --- | --- |
| GET | `/logo/:code` | Lấy ảnh logo PNG ngân hàng (public, cache header 7 ngày, full CORS) |
| GET | `/column-options` | Gợi ý giá trị cột lọc bảng (đặt trước `:id`) |
| POST | `/sync-vietqr` | Trigger đồng bộ dữ liệu + logo từ VietQR API vào database |
| GET | `/` | Danh sách ngân hàng phân trang chuẩn V2 (`items`, `pagination`), hỗ trợ search & filter |
| GET | `/:id` | Chi tiết 1 ngân hàng theo UUID |
| POST | `/` | Tạo mới ngân hàng thủ công |
| PATCH | `/:id` | Cập nhật thông tin ngân hàng |
| DELETE | `/:id` | Xóa mềm ngân hàng |

## Nguyên tắc đồng bộ và Logo

- Lần đầu: 37 ngân hàng Napas được nạp và seed vào DB qua TypeORM migration `20261119170000-create-banks-management-table-and-seed.ts`.
- Định kỳ hoặc khi có ngân hàng mới: Quản trị viên gọi `POST /api/v2/banks-management/sync-vietqr` để nạp dữ liệu mới nhất từ VietQR vào bảng `banks_management`.
- Frontend và toàn bộ hệ thống đọc dữ liệu qua endpoint nội bộ `GET /api/v2/banks-management` (phân trang và infinite scroll) và lấy ảnh logo qua `GET /api/v2/banks-management/logo/:code`, không phụ thuộc trực tiếp vào domain ngoài khi render.
