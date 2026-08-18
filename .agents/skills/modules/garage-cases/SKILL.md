---
name: garage-cases
description: Module tri thức Quản lý Vụ việc Dịch vụ Garage & Sửa chữa xe (Garage Cases, Service Lines, Receivables, Payables, Auto-Sync & Gross Profit Analysis) trong erp-api (kgara-api-core). Chứa toàn bộ database schema, entities, API endpoints, logic đồng bộ 2 chiều, phát hiện xóa mềm, đối soát lợi nhuận gộp và liên kết hóa đơn thuế.
---

# 📦 Module Tri Thức: Quản Lý Vụ Việc Dịch Vụ & Lợi Nhuận Gộp Garage (Garage Cases & Gross Profit) - Backend (`erp-api`)

## 1. Tổng quan Nghiệp vụ

Phân hệ Quản lý Vụ việc Garage (`kgara-api-core`) chịu trách nhiệm tiếp nhận, lưu trữ, xử lý và đồng bộ toàn bộ dữ liệu hoạt động sửa chữa, bảo dưỡng xe và phân tích lợi nhuận tại xưởng dịch vụ từ hệ thống KGara (Greenway).

Các nghiệp vụ trọng tâm:
- **Quản lý Hồ sơ Vụ việc Dịch vụ (`kgara_cases`)**: Lưu trữ thông tin định danh phiếu dịch vụ (`so_chung_tu`), biển số xe (`bien_so_xe`), số khung/VIN (`so_khung`), thông tin khách hàng, trạng thái tiến độ dịch vụ (Tiếp nhận -> Báo giá -> Đang sửa -> Hoàn thành -> Giao xe), cùng toàn bộ tổng tiền trước thuế, thuế VAT, tiền đã thanh toán và công nợ còn lại.
- **Chi tiết Dòng Dịch vụ & Phụ tùng (`kgara_case_services`)**: Bóc tách chi tiết từng dòng công việc trong phiếu dịch vụ, phân biệt rõ dòng công lao động (`tien_dich_vu`, `so_gio_cong_lam`) và dòng phụ tùng vật tư (`tien_phu_tung`, `gia_von_phu_tung`, `kho_code`).
- **Đồng bộ Dữ liệu Tự động & Tăng dần (Incremental Watermark Sync)**: Kết nối với API KGara bằng cơ chế Bearer Token tự động làm mới, hỗ trợ đồng bộ theo dải ngày (`from`, `to`) hoặc đồng bộ tăng dần (`updatedSince`) với bộ đệm lùi thời gian (10 phút) tránh mất mát dữ liệu.
- **Phát hiện & Quản lý Xóa mềm Vụ việc (Soft-delete & Deletion Counter)**: Thuật toán kiểm đếm số lần vắng mặt (`kgara_delete_count`). Khi vụ việc không còn tồn tại trên KGara qua 2 lần quét liên tiếp, hệ thống sẽ đánh dấu xóa mềm (`kgara_deleted_at`). Nếu vụ việc xuất hiện trở lại, hệ thống tự động phục hồi.
- **Cảnh báo Thông minh & Giám sát Tự động (Hourly Scheduler & Notifications)**: Cron job chạy hàng giờ kiểm tra tính toàn vẹn dữ liệu cho từng chi nhánh (quét 2 tháng gần nhất từ ngày chạy), tự động gửi thông báo (`NotificationsService`) tới tài khoản Admin nếu phát hiện phiếu bị xóa, đặc biệt cảnh báo nghiêm ngặt các phiếu đang có chứng từ hóa đơn liên kết.
- **Tổng hợp & Báo cáo Lợi Nhuận Gộp Vụ Việc (`kgara_gross_profit`)**: Bóc tách chỉ số tài chính $\text{Lợi Nhuận Gộp (LoiNhuan)} = \text{Doanh Thu (DoanhThu)} - \text{Chi Phí / Giá Vốn (ChiPhi)}$ theo từng vụ việc, tính tổng hợp kỳ báo cáo (`TongCong: { DoanhThu, ChiPhi, LaiGop }`), waterfall sync các tháng có phát sinh và đối soát với hóa đơn thuế GTGT.
- **Liên kết Hóa đơn Điện tử & Sổ sách ERP (`kgara_case_linked_invoice`)**: Hỗ trợ liên kết 2 chiều giữa vụ việc dịch vụ / bản ghi lợi nhuận gộp với hóa đơn điện tử (`erp_invoices`) phục vụ công tác đối soát kế toán và quyết toán chi phí.
- **Truy xuất Báo cáo Chi tiết & Sổ Nhật ký KGara (Gross Profit Journal Proxy)**: Tích hợp proxy gọi trực tiếp sang API báo cáo sổ nhật ký chi tiết (`/reports/gross-profit-detail/journal`) của KGara để kiểm tra từng bút toán chi phí gốc.
- **Quản lý Sổ Công nợ Phải thu & Phải trả (`kgara_receivables`, `kgara_payables`)**: Đồng bộ và lưu trữ sổ công nợ khách hàng (phải thu theo vụ việc) và công nợ nhà cung cấp phụ tùng/đối tác theo tài khoản kế toán 331.

---

## 2. Database Schema & Quan hệ Dữ liệu

### 2.1. Bảng `kgara_cases` (Hồ sơ Vụ việc / Phiếu Dịch vụ)

| Cột | Kiểu dữ liệu | Nullable | Mặc định | Mô tả / Ghi chú |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `uuid` | NO | `gen_random_uuid()` | Khóa chính nội bộ ERP (PK) |
| `hd_phieu_dich_vu_id` | `varchar(100)` | NO | — | Khóa định danh vụ việc từ KGara (`HdPhieuDichVuID`) (**Unique Index**) |
| `so_chung_tu` | `varchar(100)` | YES | `NULL` | Số chứng từ phiếu dịch vụ (vd: `PDV-202607-001`) |
| `bien_so_xe` | `varchar(50)` | YES | `NULL` | Biển số xe tiếp nhận sửa chữa |
| `khach_hang_code` | `varchar(100)` | YES | `NULL` | Mã định danh khách hàng |
| `khach_hang_name` | `varchar(255)` | YES | `NULL` | Tên khách hàng / chủ phương tiện |
| `tinh_trang_dich_vu` | `int` | YES | `NULL` | Mã trạng thái: 0: Tiếp nhận, 1: Báo giá, 2: Đang sửa, 3: Hoàn tất, 9: Hủy |
| `ten_tinh_trang_dich_vu` | `varchar(100)`| YES | `NULL` | Tên hiển thị trạng thái dịch vụ |
| `tien_co_thue` | `numeric(18,2)` | YES | `NULL` | Tổng giá trị phiếu đã bao gồm thuế (VNĐ) |
| `tien_da_thanh_toan` | `numeric(18,2)` | YES | `NULL` | Số tiền khách hàng đã thanh toán |
| `tien_con_phai_thanh_toan` | `numeric(18,2)` | YES | `NULL` | Số tiền công nợ còn phải thu |
| `doanh_thu` | `numeric(18,2)` | YES | `NULL` | Doanh thu ghi nhận của vụ việc |
| `chi_phi` | `numeric(18,2)` | YES | `NULL` | Tổng chi phí / giá vốn vụ việc |
| `loi_nhuan` | `numeric(18,2)` | YES | `NULL` | Lợi nhuận của vụ việc |
| `ngay_phat_sinh` | `timestamp` | YES | `NULL` | Ngày phát sinh phiếu dịch vụ |
| `ngay_tiep_nhan` | `timestamp` | YES | `NULL` | Thời điểm xe vào xưởng tiếp nhận |
| `ngay_hoan_thanh_cong_viec`| `timestamp` | YES | `NULL` | Thời điểm xưởng hoàn thành công việc |
| `ngay_giao_xe_full` | `timestamp` | YES | `NULL` | Thời điểm bàn giao xe cho khách hàng |
| `so_khung` | `varchar(100)` | YES | `NULL` | Số khung / VIN của phương tiện |
| `branch_external_id` | `varchar(100)` | YES | `NULL` | Mã chi nhánh KGara quản lý (**Index**) |
| `data_as_of` | `timestamptz` | YES | `NULL` | Dấu mốc thời gian phản hồi từ máy chủ KGara |
| `erp_notes` | `varchar` | YES | `NULL` | Ghi chú nghiệp vụ nội bộ trên ERP |
| `kgara_deleted_at` | `timestamptz` | YES | `NULL` | Thời điểm đánh dấu phiếu bị xóa trên KGara (**Index**) |
| `kgara_delete_count` | `integer` | NO | `0` | Bộ đếm số lần vắng mặt trong các kỳ sync (**Index**) |
| `raw_data` | `jsonb` | YES | `NULL` | Toàn bộ payload JSON gốc từ API KGara |
| `created_at` | `timestamptz` | NO | `now()` | Thời điểm tạo bản ghi ERP |
| `updated_at` | `timestamptz` | NO | `now()` | Thời điểm cập nhật bản ghi |

---

### 2.2. Bảng `kgara_case_services` (Dòng Chi Tiết Dịch Vụ & Phụ Tùng)

| Cột | Kiểu dữ liệu | Nullable | Mặc định | Mô tả / Ghi chú |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `uuid` | NO | `gen_random_uuid()` | Khóa chính dòng chi tiết (PK) |
| `hd_phieu_dich_vu_chi_tiet_id` | `varchar(100)` | NO | — | Mã chi tiết dòng từ KGara (**Unique Index**) |
| `hd_phieu_dich_vu_id` | `varchar(100)` | NO | — | Mã vụ việc cha (`HdPhieuDichVuID`) (**Index**) |
| `noi_dung_chi_tiet` | `text` | YES | `NULL` | Tên hoặc mô tả chi tiết hạng mục |
| `san_pham_code` | `varchar(100)` | YES | `NULL` | Mã sản phẩm / mã phụ tùng / mã dịch vụ |
| `san_pham_name` | `varchar(255)` | YES | `NULL` | Tên sản phẩm / phụ tùng / công việc |
| `loai_san_pham_code` | `varchar(50)` | YES | `NULL` | Phân loại: `'PT'` (Phụ tùng), `'DV'` (Công thợ/Dịch vụ) |
| `don_vi_tinh_text` | `varchar(50)` | YES | `NULL` | Đơn vị tính (Bộ, Cái, Công, Bình,...) |
| `so_luong_hoa_don` | `numeric(18,4)` | YES | `NULL` | Số lượng phát sinh |
| `don_gia` | `numeric(18,2)` | YES | `NULL` | Đơn giá trước thuế |
| `tien_chua_thue` | `numeric(18,2)` | YES | `NULL` | Thành tiền trước thuế |
| `thue_suat` | `numeric(5,2)` | YES | `NULL` | Thuế suất VAT (%) |
| `tien_co_thue` | `numeric(18,2)` | YES | `NULL` | Thành tiền sau thuế |
| `so_gio_cong_lam` | `numeric(18,2)` | YES | `NULL` | Số giờ công kỹ thuật viên thực hiện |
| `tien_dich_vu` | `numeric(18,2)` | YES | `NULL` | Tiền công dịch vụ |
| `tien_phu_tung` | `numeric(18,2)` | YES | `NULL` | Tiền bán phụ tùng |
| `gia_von_phu_tung` | `numeric(18,2)` | YES | `NULL` | Giá vốn xuất kho của phụ tùng |
| `ty_le_chiet_khau_ct` | `numeric(18,2)` | YES | `NULL` | Tỷ lệ chiết khấu dòng (%) |
| `tien_chiet_khau_ct` | `numeric(18,2)` | YES | `NULL` | Tiền chiết khấu dòng |
| `kho_code` | `varchar(100)` | YES | `NULL` | Mã kho xuất phụ tùng |
| `tien_phu_phi` | `numeric(18,2)` | YES | `NULL` | Phụ phí liên quan |
| `raw_data` | `jsonb` | YES | `NULL` | Dữ liệu dòng gốc từ KGara |
| `created_at` | `timestamptz` | NO | `now()` | Thời điểm tạo |
| `updated_at` | `timestamptz` | NO | `now()` | Thời điểm cập nhật |

---

### 2.3. Bảng `kgara_gross_profit` (Sổ Tổng Hợp Lợi Nhuận Gộp Vụ Việc)

| Cột | Kiểu dữ liệu | Nullable | Mặc định | Mô tả / Ràng buộc |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `uuid` | NO | `gen_random_uuid()` | Khóa chính nội bộ ERP (PK) |
| `hd_phieu_dich_vu_id` | `varchar(100)` | NO | — | Khóa ngoại tham chiếu mã vụ việc KGara (`HdPhieuDichVuID`) (**Unique Index**) |
| `branch_external_id` | `varchar(100)` | YES | `NULL` | Mã chi nhánh KGara quản lý (**Index**) |
| `vu_viec_code` | `varchar(100)` | YES | `NULL` | Mã số chứng từ / số phiếu vụ việc (vd: `PDV-202607-001`) |
| `vu_viec_name` | `varchar(255)` | YES | `NULL` | Tên vụ việc hoặc tóm tắt nội dung dịch vụ |
| `ten_khach_hang` | `varchar(255)` | YES | `NULL` | Tên khách hàng / chủ xe |
| `doanh_thu` | `numeric(18,2)` | YES | `NULL` | Tổng doanh thu ghi nhận từ vụ việc (VNĐ) |
| `chi_phi` | `numeric(18,2)` | YES | `NULL` | Tổng chi phí / giá vốn phụ tùng & dịch vụ (VNĐ) |
| `loi_nhuan` | `numeric(18,2)` | YES | `NULL` | Lợi nhuận gộp ($\text{DoanhThu} - \text{ChiPhi}$) |
| `report_from` | `date` | YES | `NULL` | Ngày bắt đầu kỳ báo cáo đồng bộ |
| `report_to` | `date` | YES | `NULL` | Ngày kết thúc kỳ báo cáo đồng bộ |
| `raw_data` | `jsonb` | YES | `NULL` | Payload JSON chi tiết từ API báo cáo KGara |
| `created_at` | `timestamptz` | NO | `now()` | Thời điểm tạo bản ghi |
| `updated_at` | `timestamptz` | NO | `now()` | Thời điểm cập nhật bản ghi |

---

### 2.4. Bảng `kgara_case_linked_invoice` (Liên Kết Hóa Đơn Điện Tử)

| Cột | Kiểu dữ liệu | Nullable | Mặc định | Mô tả / Ràng buộc |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `uuid` | NO | `gen_random_uuid()` | Khóa chính (PK) |
| `caseDbId` | `uuid` | YES | `NULL` | FK tham chiếu `kgara_cases.id` (ON DELETE CASCADE) |
| `gross_profit_id` | `uuid` | YES | `NULL` | FK tham chiếu `kgara_gross_profit.id` (ON DELETE CASCADE) |
| `invoiceId` | `uuid` | NO | — | FK tham chiếu `erp_invoices.id` |
| `linkType` | `varchar(10)` | NO | `'IN'` | Loại liên kết: `'IN'` (Hóa đơn đầu vào) hoặc `'OUT'` (Hóa đơn đầu ra) |
| `note` | `varchar` | YES | `NULL` | Ghi chú lý do liên kết chứng từ |
| `created_at` | `timestamptz` | NO | `now()` | Thời điểm tạo |
| `updated_at` | `timestamptz` | NO | `now()` | Thời điểm cập nhật |

> **Ràng buộc duy nhất**: `UNIQUE ("caseDbId", "invoiceId")` ngăn chặn việc gắn trùng một hóa đơn vào cùng một vụ việc.

---

### 2.5. Sơ đồ Quan hệ Dữ liệu (ERD)

```text
       ┌───────────────────────────────┐
       │         kgara_cases           │
       ├───────────────────────────────┤
       │ id (PK)                       │
       │ hd_phieu_dich_vu_id (UQ) ─────┼────────┐
       │ so_chung_tu                   │        │
       │ bien_so_xe                    │        │
       │ ...                           │        │
       └──────────────┬────────────────┘        │
                      │ 1                       │ 1
                      │                         │
                      │ N                       │ 1
       ┌──────────────┴────────────────┐        │
       │   kgara_case_linked_invoice   │        │
       ├───────────────────────────────┤        │
       │ id (PK)                       │        │
       │ caseDbId (FK)                 │        │
       │ gross_profit_id (FK) ─────────┼──┐     │
       │ invoiceId (FK -> erp_invoices)│  │     │
       │ linkType ('IN' | 'OUT')       │  │     │
       └───────────────────────────────┘  │     │
                                          │ N   │
                                          │     │
                               ┌──────────┴─────┴──────────────┐
                               │       kgara_gross_profit      │
                               ├───────────────────────────────┤
                               │ id (PK)                       │
                               │ hd_phieu_dich_vu_id (UQ/FK)   │
                               │ vu_viec_code                  │
                               │ doanh_thu                     │
                               │ chi_phi                       │
                               │ loi_nhuan                     │
                               │ report_from / report_to       │
                               └───────────────────────────────┘
```

---

### 2.6. Bảng `kgara_receivables` & `kgara_payables` (Sổ Công Nợ Kho & Xưởng)

- **`kgara_receivables`**: Sổ công nợ phải thu từ khách hàng theo vụ việc dịch vụ.
  - Khóa phức hợp duy nhất: `branch_external_id + hd_phieu_dich_vu_id + so_chung_tu + period_from + period_to`.
- **`kgara_payables`**: Sổ chi tiết công nợ phải trả (TK 331) theo từng đối tác/nhà cung cấp.
  - Khóa phức hợp duy nhất: `branch_external_id + tai_khoan_id + doi_tac_id + ma_so_tien_te + ma_so_vu_viec + period_from + period_to`.

---

### 2.7. Bảng `kgara_branches`, `kgara_auth`, `kgara_sync_runs`

- **`kgara_branches`**: Danh mục chi nhánh / phân xưởng KGara (`external_id`, `code`, `name`, `parent_id`, `is_active`).
- **`kgara_auth`**: Lưu trữ phiên đăng nhập KGara (`access_token`, `refresh_token`, `token_expires`, `ss_client_id`).
- **`kgara_sync_runs`**: Nhật ký chi tiết từng lần gọi API đồng bộ (`endpoint`, `status`, `row_count`, `request_started_at`, `request_ended_at`, `error_message`, `data_as_of`).

---

## 3. Cấu trúc Source Code Backend

```text
src/kgara-api-core/
├── entities/
│   ├── kgara_auth.entity.ts                # Entity bảng kgara_auth (lưu OAuth token & SS_ClientID)
│   ├── kgara_branch.entity.ts              # Entity bảng kgara_branches (danh mục chi nhánh xưởng)
│   ├── kgara_case.entity.ts                # Entity bảng kgara_cases (phiếu dịch vụ / vụ việc)
│   ├── kgara_case_linked_invoice.entity.ts # Entity bảng kgara_case_linked_invoice (liên kết HĐĐT ERP & Gross Profit)
│   ├── kgara_case_service.entity.ts        # Entity bảng kgara_case_services (chi tiết công việc/phụ tùng)
│   ├── kgara_gross_profit.entity.ts        # Entity bảng kgara_gross_profit (tổng hợp lợi nhuận gộp)
│   ├── kgara_payable.entity.ts             # Entity bảng kgara_payables (sổ công nợ phải trả 331)
│   ├── kgara_receivable.entity.ts          # Entity bảng kgara_receivables (sổ công nợ phải thu)
│   └── kgara_sync_run.entity.ts            # Entity bảng kgara_sync_runs (nhật ký đồng bộ)
├── kgara-api-core.controller.ts            # Controller định tuyến API /api/v1/greenway
├── kgara-api-core.module.ts                # Module NestJS đăng ký TypeORM và Providers
├── kgara-auth.service.ts                   # Service quản lý xác thực token KGara và mutex refresh
├── kgara-client.service.ts                 # HTTP Client giao tiếp API KGara (kèm retry khi 401, gross profit proxies)
├── kgara-sync.scheduler.ts                 # Cron Scheduler định kỳ hàng giờ quét dữ liệu 2 tháng và gửi thông báo
├── kgara-sync.service.ts                   # Service xử lý nghiệp vụ sync, phân trang, watermark, soft-delete & gross profit
└── kgara-sync.service.spec.ts              # Bộ Unit Test kiểm thử logic sync và soft-delete
```

---

## 4. Danh sách API Endpoints & RBAC Contract

Controller Base Route: `/api/v1/greenway`  
Header nhận diện Chi nhánh: `x-kgara-branch-id` hoặc `x-greenway-branch-id`

### 4.1. Nhóm Vụ Việc & Dòng Dịch Vụ
| Method | Endpoint | Tham số / Header | Mô tả Nghiệp vụ |
| :--- | :--- | :--- | :--- |
| `GET` | `/branches` | — | Lấy danh sách tất cả các chi nhánh xưởng dịch vụ |
| `GET` | `/cases` | `@BranchId()`, `page`, `pageSize`, `q`, `from`, `to`, `filtersStr`, `includeDeleted` | Lấy danh sách vụ việc có phân trang, tìm kiếm đa trường và lọc nâng cao |
| `GET` | `/cases/column-options` | `@BranchId()`, `column`, `search`, `page`, `pageSize`, `filtersStr` | Lấy danh sách giá trị distinct phân trang cho bộ lọc từng cột của bảng |
| `GET` | `/cases/:id` | `id` (UUID ERP) | Lấy chi tiết một vụ việc theo khóa chính nội bộ ERP |
| `GET` | `/cases/by-code/:code`| `code` (`so_chung_tu`) | Tra cứu vụ việc theo số chứng từ (tự động fetch detail từ KGara nếu thiếu dòng) |
| `GET` | `/cases/external/:externalId` | `externalId` (`hd_phieu_dich_vu_id`), `branchId` | Tra cứu vụ việc theo ID KGara (tự động kích hoạt sync detail nếu chưa có trong DB) |
| `PATCH`| `/cases/:id/erp-notes` | `id`, Body: `{ erpNotes: string \| null }` | Cập nhật ghi chú nghiệp vụ nội bộ của ERP cho vụ việc |
| `GET` | `/cases/:id/services` | `id` (`hd_phieu_dich_vu_id`) | Lấy danh sách chi tiết các dòng công việc và phụ tùng của vụ việc |
| `GET` | `/cases/:id/payments` | `id` (`hd_phieu_dich_vu_id`) | Lấy lịch sử thanh toán của vụ việc (trả về mảng rỗng do KGara V2 quản lý qua receivable) |
| `GET` | `/cases/:id/linked-invoices` | `id` (`caseDbId`) | Lấy danh sách hóa đơn điện tử (`erp_invoices`) đang liên kết với vụ việc |
| `POST`| `/cases/:id/linked-invoices` | `id`, Body: `{ invoiceId, linkType, note }` | Gắn liên kết một hóa đơn điện tử vào vụ việc |
| `DELETE`| `/cases/:id/linked-invoices/:linkedId` | `id`, `linkedId` | Xóa liên kết hóa đơn khỏi vụ việc |
| `GET` | `/invoices/:invoiceId/linked-cases` | `invoiceId` (UUID ERP Invoice) | Tra cứu ngược danh sách các vụ việc dịch vụ đang liên kết với hóa đơn này |

### 4.2. Nhóm Lợi Nhuận Gộp & Đối Soát Báo Cáo
| Method | Endpoint | Tham số / Body | Mô tả Nghiệp vụ |
| :--- | :--- | :--- | :--- |
| `GET` | `/cases/gross-profit-report` | `@BranchId()`, Query: `from`, `to` | Lấy báo cáo tổng hợp lợi nhuận gộp kèm chi tiết từng vụ việc và tính tổng hợp (`TongCong`) |
| `GET` | `/cases/by-code/:code/gross-profit` | `code` (`so_chung_tu`) | Tra cứu nhanh chỉ số Doanh thu / Chi phí / Lợi nhuận theo mã vụ việc |
| `POST`| `/sync/gross-profit` | `@BranchId()`, Query: `from`, `to` | Kích hoạt tác vụ đồng bộ lợi nhuận gộp từ KGara theo chi nhánh và khoảng ngày |
| `GET` | `/reports/gross-profit-detail` | `@BranchId()`, Query: `from`, `to` | Proxy gọi trực tiếp API báo cáo chi tiết lợi nhuận gộp từ máy chủ KGara |
| `GET` | `/reports/gross-profit-detail/journal` | `@BranchId()`, Query: `from`, `to`, `vuViecID` | Proxy lấy sổ nhật ký hạch toán chi phí/doanh thu chi tiết của vụ việc |
| `GET` | `/gross-profit/:id/linked-invoices` | `id` (UUID `kgara_gross_profit`) | Lấy danh sách hóa đơn điện tử đang liên kết với bản ghi lợi nhuận gộp này |
| `POST`| `/gross-profit/:id/linked-invoices` | `id`, Body: `{ invoiceId, linkType, note }` | Gắn liên kết một hóa đơn điện tử (đầu vào hoặc đầu ra) vào bản ghi lợi nhuận gộp |
| `DELETE`| `/gross-profit/:id/linked-invoices/:linkedId` | `id`, `linkedId` | Hủy liên kết hóa đơn khỏi bản ghi lợi nhuận gộp |

### 4.3. Nhóm Đồng Bộ & Sổ Kế Toán
| Method | Endpoint | Tham số / Header | Mô tả Nghiệp vụ |
| :--- | :--- | :--- | :--- |
| `POST`| `/sync/all` | `@BranchId()` | Chạy chuỗi đồng bộ toàn diện: Chi nhánh -> Vụ việc -> Phải thu -> Phải trả |
| `POST`| `/sync/branches` | — | Đồng bộ danh mục chi nhánh từ KGara |
| `POST`| `/sync/cases` | `@BranchId()`, Query: `from`, `to` | Đồng bộ toàn bộ vụ việc trong khoảng ngày và thực hiện kiểm đếm xóa mềm |
| `POST`| `/sync/cases/incremental` | `@BranchId()` | Đồng bộ tăng dần các vụ việc thay đổi từ mốc watermark gần nhất |
| `POST`| `/sync/cases/:id/detail`| `@BranchId()`, `id` (`hd_phieu_dich_vu_id`) | Đồng bộ chi tiết dòng dịch vụ/phụ tùng cho một vụ việc cụ thể |
| `POST`| `/sync/receivables` | `@BranchId()`, Query: `from`, `to` | Đồng bộ sổ công nợ phải thu từ KGara |
| `POST`| `/sync/payables` | `@BranchId()`, Query: `from`, `to` | Đồng bộ sổ công nợ phải trả theo TK 331 |
| `GET` | `/sync-runs` | `@BranchId()`, `take` (mặc định 50) | Lấy lịch sử nhật ký các lần chạy đồng bộ gần nhất |
| `GET` | `/receivables` | `@BranchId()` | Lấy danh sách công nợ phải thu đã đồng bộ |
| `GET` | `/payables` | `@BranchId()` | Lấy danh sách công nợ phải trả đã đồng bộ |
| `GET` | `/dashboard` | `@BranchId()`, `from`, `to` | Lấy dữ liệu tổng quan dashboard vụ việc trực tiếp từ KGara |

---

## 5. Logic Nghiệp vụ Trọng tâm

### 5.1. Quản lý Phiên Xác thực & Mutex Token Refresh (`KgaraAuthService`)
- Tự động kiểm tra thời hạn token (`tokenExpires`). Nếu token còn hạn > 5 phút thì tái sử dụng.
- Khi token hết hạn hoặc nhận mã `401 Unauthorized`:
  - Kích hoạt cơ chế khóa Mutex (`executeRefreshLocked`) đảm bảo tại một thời điểm chỉ có duy nhất 1 luồng gửi yêu cầu `refresh-token` lên máy chủ KGara, tránh tình trạng race-condition làm vô hiệu hóa token.
  - Tự động fallback đăng nhập lại (`login`) nếu refresh token không hợp lệ.

### 5.2. Đồng bộ Tăng dần theo Watermark (`getIncrementalWatermark`)
- Hệ thống tra cứu bản ghi thành công gần nhất trong bảng `kgara_sync_runs` tương ứng với chi nhánh và endpoint.
- Thời điểm watermark được trừ lùi **10 phút** (`requestStartedAt - 10 * 60 * 1000`) nhằm bảo toàn dữ liệu tránh độ trễ đồng bộ (clock drift / in-flight transactions).

### 5.3. Thuật toán Phát hiện Xóa Mềm Vụ việc (`detectAndMarkDeletedCases`)
1. Khi đồng bộ theo khoảng ngày (`from`, `to`), hệ thống lấy toàn bộ danh sách `hd_phieu_dich_vu_id` trả về từ API KGara đưa vào tập hợp `syncedIds`.
2. Truy vấn các vụ việc trong DB của ERP cùng chi nhánh và khoảng ngày chưa bị đánh dấu xóa mềm (`kgara_deleted_at IS NULL`).
3. Xác định các vụ việc có trong ERP nhưng không xuất hiện trong `syncedIds`.
4. Tăng bộ đếm `kgara_delete_count += 1`.
5. Nếu `kgara_delete_count >= 2`: Đánh dấu `kgara_deleted_at = now()`.
6. Nếu một vụ việc đã bị xóa mềm sau đó xuất hiện trở lại trong danh sách sync: Hệ thống tự động đặt lại `kgara_deleted_at = null` và `kgara_delete_count = 0` (Restoration).

### 5.4. Lịch Quét Tự động Hàng Giờ 2 Tháng Gần Nhất & Cảnh báo Admin (`KgaraSyncScheduler`)
- Chạy tự động vào mỗi đầu giờ (`@Cron(CronExpression.EVERY_HOUR)`).
- **Cửa sổ đồng bộ nâng cao**: Quét dữ liệu trong phạm vi **2 tháng gần nhất tính từ thời điểm chạy** (`firstDayTwoMonthsAgo` đến `now`) cho tất cả chi nhánh đang hoạt động.
- Nếu phát hiện vụ việc bị xóa mềm:
  - Tự động kiểm tra liên kết hóa đơn trong `kgara_case_linked_invoice`.
  - Gửi thông báo loại `WARNING` tới tất cả Admin nếu vụ việc bị xóa đang có hóa đơn liên kết; gửi thông báo loại `INFO` nếu không có hóa đơn liên kết.

### 5.5. Thuật toán Tổng Hợp Báo Cáo Lợi Nhuận Gộp (`getGrossProfitReport`)
1. Truy vấn toàn bộ bản ghi trong bảng `kgara_gross_profit` theo `branchExternalId` và dải ngày `reportFrom >= from`, `reportTo <= to`.
2. Thực hiện `leftJoinAndMapOne` với bảng `kgara_cases` dựa trên điều kiện `case.soChungTu = gp.vuViecCode` để bổ sung toàn bộ metadata của xe (biển số xe, ngày phát sinh, khách hàng).
3. Duyệt danh sách, chuyển đổi kiểu dữ liệu (`Number(gp.doanhThu)`, `Number(gp.chiPhi)`, `Number(gp.loiNhuan)`).
4. Tích lũy tổng doanh thu (`totalRevenue`), tổng chi phí (`totalCost`), tổng lãi gộp (`totalProfit`).
5. Trả về cấu trúc chuẩn tương thích giao diện UI (`results: { TongCong, Groups }`).

### 5.6. Cơ chế Đồng bộ Tự động Lợi Nhuận Đa Tháng (`syncCasesForBranch` Waterfall Sync)
- Khi thực hiện đồng bộ vụ việc (`syncCasesForBranch`), hệ thống tự động ghi nhận danh sách các ngày phát sinh vụ việc (`updatedCaseDates`).
- Nếu người dùng không chỉ định khoảng ngày (`from`, `to`), hệ thống tự động sinh dải ngày:
  - Tháng hiện tại: từ ngày 1 đến ngày cuối tháng.
  - Các tháng trước/sau có vụ việc thay đổi (`monthsToSync`).
- Hệ thống duyệt qua từng khoảng tháng và gọi `getGrossProfitDetail`, sau đó thực hiện lệnh `upsert` trên bảng `kgara_gross_profit` theo khóa xung đột `['hdPhieuDichVuId']`.

### 5.7. Đối Soát & Kiểm Tra Hóa Đơn Thuế Gắn Kèm (`kgara_case_linked_invoice`)
- Phân loại 2 chiều:
  - `linkType = 'IN'`: Hóa đơn mua phụ tùng, dầu nhớt, vật tư tiêu hao đầu vào cấu thành nên chi phí vụ việc.
  - `linkType = 'OUT'`: Hóa đơn điện tử VAT xuất cho khách hàng tương ứng với doanh thu dịch vụ.
- Ràng buộc toàn vẹn: Khi bản ghi `kgara_gross_profit` hoặc `kgara_cases` bị xóa, các dòng liên kết hóa đơn tương ứng sẽ tự động bị xóa theo (`onDelete: 'CASCADE'`), đảm bảo không để lại bản ghi mồ côi.

---

## 6. Tích hợp Liên Module

- **`erp-invoices-core`**:
  - Cho phép người dùng liên kết chéo hóa đơn đầu vào mua phụ tùng (`IN`) hoặc hóa đơn đầu ra dịch vụ (`OUT`) với từng vụ việc / bản ghi lợi nhuận gộp qua bảng `kgara_case_linked_invoice`.
  - Hỗ trợ xem danh sách vụ việc từ màn hình hóa đơn và ngược lại.
- **`notifications`**:
  - Gửi thông báo real-time tới chuông thông báo người dùng và admin khi phát hiện bất thường về dữ liệu đồng bộ hoặc xóa phiếu.

---

## 7. Quy tắc Kiểm thử & Báo cáo Chất lượng (QC Mandate)

Khi chỉnh sửa `kgara-api-core`:
1. Chạy Type-check: `bun run check:ci`
2. Chạy Unit test: `bunx jest src/kgara-api-core/ --forceExit`
3. Xác minh migration `1780000000000-AddKgaraGrossProfit.ts`, `1785128452000-AddKgaraColumns.ts` và `1786414442074-LedgerCascade.ts`.
