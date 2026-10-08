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
- **Cảnh báo Thông minh & Giám sát Tự động (5-Slot Heartbeat Scheduler & Notifications)**: Scheduler chạy tự động tại 5 mốc giờ (`09:15`, `15:15`, `16:15`, `17:15`, `21:15` Asia/Ho_Chi_Minh) theo cơ chế Heartbeat 30s kết hợp `@Cron` dự phòng, quét dữ liệu 2 tháng gần nhất cho từng chi nhánh, tự động nạp chi tiết phụ tùng/công thợ (`syncCaseDetailsBatch`), và gửi thông báo an toàn qua RBAC (`CorePermission`/`CoreUserRole`) tới tài khoản có quyền khi phát hiện phiếu bị xóa hoặc có cảnh báo.
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
| `category_id` | `uuid` | YES | `NULL` | Khóa ngoại danh mục phân loại (`FK -> erp_module_categories.id`) (**Index**) |
| `classification` | `varchar(100)` | YES | `NULL` | Mã phân loại nghiệp vụ ERP: `'SUA_CHUA_CHUNG'`, `'KY_GUI_NOI_BO'`, `'OJ'`, `'KHAC'` (**Index**). Đã chuẩn hóa toàn bộ `'OJ_NGOAI'` về `'OJ'`. |
| `exclude_from_reports` | `boolean` | NO | `false` | Cờ loại trừ khỏi báo cáo P&L xưởng & Dashboard (**Index**) |
| `exclude_from_debt` | `boolean` | NO | `false` | Cờ loại trừ khỏi tính toán công nợ khách hàng (**Index**). Khi phân loại là `'OJ'`, hệ thống tự động kích hoạt `exclude_from_debt = true`. |
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
├── controllers/
│   ├── kgara-cases.controller.ts           # Controller danh sách, chi tiết, filter, options & lãi gộp vụ việc
│   ├── kgara-case-financial.controller.ts  # Controller tài chính vụ việc, cấn trừ sao kê & liên kết hóa đơn
│   ├── kgara-customers.controller.ts       # Controller công nợ khách hàng & lịch sử theo khách
│   ├── kgara-suppliers.controller.ts       # Controller công nợ nhà cung cấp & theo NCC
│   ├── kgara-gross-profit.controller.ts    # Controller hóa đơn liên kết lãi gộp
│   ├── kgara-sync.controller.ts            # Controller kích hoạt sync dữ liệu KGara
│   └── kgara-reports.controller.ts         # Controller báo cáo, dashboard, raw receivables/payables
├── decorators/
│   └── branch-id.decorator.ts              # Custom parameter decorator @BranchId()
├── utils/
│   └── kgara-parser.util.ts                # Parser helpers (parseSafeDate, extractNetPayableAmount)
├── helpers/
│   ├── kgara-excel-style.helper.ts         # Layout helper xuất Excel chuẩn hóa (SUM, SUBTOTAL, Freeze, COMPLETED_CASES_COLUMNS, CASE_PNL_COLUMNS & buildGarageCaseExportFileName)
│   ├── kgara-completed-cases-sheet.builder.ts # Sheet Builders cho file xuất Excel đa sheets (Sheet 1: Thu/Trả P1, Sheet 2: Theo dõi PnL, Sheet 3: Chi tiết DV/PT)
│   ├── kgara-case-filter.helper.ts         # Helper chuẩn hóa bộ lọc SQL cho Vụ việc (hỗ trợ caseCode lọc theo cả Số chứng từ VÀ Biển số xe, lọc cột & distinct options)
│   └── kgara-case-filter.helper.spec.ts    # Unit test cho KgaraCaseFilterHelper
├── kgara-api-core.controller.ts            # Controller gốc quản lý lifecycle onModuleInit & re-export @BranchId()
├── kgara-api-core.module.ts                # Module NestJS đăng ký TypeORM, Sub-Controllers và Providers
├── kgara-auth.service.ts                   # Service quản lý xác thực token KGara và mutex refresh
├── kgara-client.service.ts                 # HTTP Client giao tiếp API KGara (kèm retry khi 401, gross profit proxies)
├── kgara-sync.scheduler.ts                 # Cron Scheduler định kỳ hàng giờ quét dữ liệu 2 tháng và gửi thông báo
├── kgara-sync.service.ts                   # Facade Service đồng bộ dữ liệu KGara
├── kgara-sync.service.spec.ts              # Bộ Unit Test kiểm thử logic sync và soft-delete
└── services/
    ├── kgara-case-export.service.ts        # Facade Service (< 50 LoC) điều phối xuất Excel theo chuẩn api-service-refactor
    ├── kgara-completed-cases-export.service.ts # Sub-Service chuyên trách xuất file Excel 3 Sheets bảng kê phiếu kết thúc, theo dõi PnL và chi tiết DV/PT (< 300 LoC)
    ├── kgara-case-services-export.service.ts # Sub-Service chuyên trách xuất riêng bảng kê chi tiết dịch vụ & phụ tùng (< 150 LoC)
    ├── kgara-case-list-query.service.ts    # Sub-Service chuyên trách tìm kiếm danh sách vụ việc, phân trang, lọc distinct options theo số chứng từ / biển số xe và báo cáo lãi gộp
    ├── sync-case.service.ts                # Sub-Service đồng bộ chi nhánh, danh sách vụ việc, chi tiết dòng dịch vụ
    ├── sync-gross-profit.service.ts        # Sub-Service đồng bộ báo cáo lãi gộp
    ├── sync-debt.service.ts                # Sub-Service đồng bộ sổ nợ phải thu (AR) & phải trả NCC 331 (AP)
    ├── sync-deletion.service.ts            # Sub-Service thuật toán phát hiện và đánh dấu xóa mềm
    ├── sync-run-logger.service.ts          # Sub-Service quản lý audit log (GwSyncRun) & incremental watermark
    ├── kgara-case-query.service.ts         # Facade Query engine & recalculateCaseSettlementSummary helper (< 300 LoC)
    ├── kgara-case-config.service.ts        # Sub-Service quản lý phân loại danh mục, cờ loại trừ (báo cáo, công nợ) & EAV custom fields
    ├── kgara-case-config.service.spec.ts   # Unit test cho KgaraCaseConfigService
    ├── garage-smart-settlement.service.ts  # Thuật toán gợi ý cấn trừ sao kê ERP thông minh cho Vụ việc (Số chứng từ, Biển số xe, Đối tác)
    └── garage-smart-settlement.service.spec.ts # Unit tests cho gợi ý cấn trừ vụ việc
```

---

## 4. Danh sách API Endpoints & RBAC Contract

Controller Base Route: `/api/v1/greenway`  
Header nhận diện Chi nhánh: `x-kgara-branch-id` hoặc `x-greenway-branch-id`

### 4.1. Nhóm Vụ Việc & Dòng Dịch Vụ
| Method | Endpoint | Tham số / Header | Mô tả Nghiệp vụ |
| :--- | :--- | :--- | :--- |
| `GET` | `/branches` | — | Lấy danh sách tất cả các chi nhánh xưởng dịch vụ |
| `GET` | `/cases` | `@BranchId()`, `page`, `pageSize`, `q`, `from`, `to`, `filtersStr`, `includeDeleted`, `sorts` | Lấy danh sách vụ việc có phân trang, tìm kiếm đa trường, lọc nâng cao (`statusTab`, `classification`, `hasInvoice`, `hasLinkedInvoice`, `collectionProgress`, `costProgress`, `margin`), bóc tách số lượng hóa đơn liên kết (`linkedInvoiceCount`, `linkedInvoiceOutCount`, `linkedInvoiceInCount`), hỗ trợ sắp xếp đa cột server-side qua `sorts`, và trả về `totals` (`grandTotal`, `cumulative`) phục vụ thanh tổng hợp SubtotalSummaryCell |
| `GET` | `/cases/export/excel` | `branchId`, `date_from`, `date_to`, `date_type`, `classification`, `status`, `q` | Xuất file Excel 3 Sheets chuyên nghiệp (`Bảng kê phiếu kết thúc` & công nợ hai chiều Thu/Trả, `Theo dõi PnL` phân tích lợi nhuận gộp/biên LN/đánh giá sinh lời, và `Chi tiết DV & Phụ tùng`) cho các vụ việc đã kết thúc theo kỳ, gắn công thức Excel động tự động tính cấn trừ Phải - Đã |
| `GET` | `/cases/column-options` | `@BranchId()`, `column`, `search`, `page`, `pageSize`, `filtersStr` | Lấy danh sách giá trị distinct phân trang cho bộ lọc từng cột của bảng (hỗ trợ `caseCode` ghép Số chứng từ + Biển số xe, `hasInvoice` đồng bộ theo `TienThueKH > 0`, `hasLinkedInvoice`, `statusName`, `classification`, `soChungTu`, `bienSoXe`, `khachHangName`...) |
| `GET` | `/cases/:id` | `id` (UUID ERP) | Lấy chi tiết một vụ việc theo khóa chính nội bộ ERP (được bảo vệ bởi Regex UUID guard tránh nuốt các route con) |
| `GET` | `/cases/by-code/:code`| `code` (`so_chung_tu` hoặc UUID `id`/`hd_phieu_dich_vu_id`) | Tra cứu vụ việc theo số chứng từ hoặc UUID (xử lý qua `KgaraCaseLookupService`: tự nhận diện UUID để query theo `id`/`soChungTu`/`hdPhieuDichVuId`, nạp quan hệ `category` chuẩn Module Config, EAV custom fields, và tự động fetch detail từ KGara nếu thiếu dòng) |
| `GET` | `/cases/external/:externalId` | `externalId` (`hd_phieu_dich_vu_id`), `branchId` | Tra cứu vụ việc theo ID KGara (tự động kích hoạt sync detail nếu chưa có trong DB) |
| `PATCH`| `/cases/:id/lines-cost` | `id`, Body: `{ lines: [{ detailId, giaVonPhuTung }] }` | Cập nhật giá vốn thủ công cho từng dòng phụ tùng của vụ việc (lưu vào `kgara_case_services` và `rawData`) |
| `PATCH`| `/cases/:id/config` | `id`, Body: `UpdateCaseConfigDto` (`categoryId`, `classification`, `excludeFromReports`, `excludeFromDebt`, `erpNotes`, `customAttributes`, `attributes`, `globalAttributes`) | Cập nhật phân loại danh mục Module Config, 2 cờ loại trừ (báo cáo, công nợ), ghi chú và thuộc tính động cho vụ việc |
| `PATCH`| `/cases/:id/erp-notes` | `id`, Body: `{ erpNotes: string \| null }` | Cập nhật ghi chú nghiệp vụ nội bộ của ERP cho vụ việc (Legacy alias) |
| `GET` | `/cases/:id/services` | `id` (`hd_phieu_dich_vu_id`) | Lấy danh sách chi tiết các dòng công việc và phụ tùng của vụ việc |
| `GET` | `/cases/:id/payments` | `id` (`hd_phieu_dich_vu_id`) | Lấy lịch sử thanh toán của vụ việc (trả về mảng rỗng do KGara V2 quản lý qua receivable) |
| `GET` | `/cases/:id/linked-invoices` | `id` (`caseDbId`) | Lấy danh sách hóa đơn điện tử (`erp_invoices`) đang liên kết với vụ việc |
| `POST`| `/cases/:id/linked-invoices` | `id`, Body: `{ invoiceId, linkType, note }` \| `{ items: [...] }` \| `Array<{ invoiceId, linkType, note }>` | Gắn liên kết một hoặc nhiều hóa đơn điện tử vào vụ việc (hỗ trợ batch insert và tự động tạo netoff) |
| `DELETE`| `/cases/:id/linked-invoices/:linkedId` | `id`, `linkedId` | Xóa liên kết hóa đơn khỏi vụ việc |
| `GET` | `/invoices/:invoiceId/linked-cases` | `invoiceId` (UUID ERP Invoice) | Tra cứu ngược danh sách các vụ việc dịch vụ đang liên kết với hóa đơn này |
| `GET` | `/cases/:id/traceability-graph` | `id` (UUID Case) | Lấy cây phả hệ mạng lưới chứng từ liên đới (Phiếu DV -> Hóa đơn -> Sao kê/Sổ quỹ -> Sổ cái GL) |
| `GET` | `/cases/:id/financial-summary` | `id` (UUID Case) | Ma trận tài chính 3 tầng (Doanh thu, Chi phí, Đã thu đa kênh, Còn phải thu, Lãi thực tế, Đối soát KGara) |
| `GET` | `/cases/customers-debt` | `@BranchId()`, Query: `page`, `pageSize`, `q`, `from`, `to`, `sorts`, `column_filters`, `column_search` | Tổng hợp công nợ khách hàng theo phiếu DV, tính tuổi nợ (Aging 0-30, 31-60, 61-90, >90), phân bổ chi nhánh, lọc HAVING theo `paymentProgress` (PAID, PARTIAL, UNPAID), `maxAgingDays`, `caseCount` (số lượng phiếu), `totalAmount` (phân khoảng <10m, 10-20m, 20-50m, >50m), mốc baseline 07/2026 |
| `GET` | `/cases/customers-debt/column-options` | `@BranchId()`, Query: `column`, `search`, `page`, `pageSize`, `filtersStr` | Danh sách options phân trang distinct cho bộ lọc cột bảng công nợ khách hàng (`customerCode`, `customerName`, `branchName`, `paymentProgress`, `maxAgingDays`, `caseCount`, `totalAmount`) |
| `GET` | `/cases/:id/smart-settlement-suggestions` | `id` (UUID Case), Query: `type` (`RECEIPT` \| `PAYMENT`) | Gợi ý đối soát sao kê thông minh từ DB cho Vụ việc (Khớp Tiền + Số chứng từ + Biển số xe + Khách hàng) |
| `GET` | `/cases/:id/smart-invoice-suggestions` | `id` (UUID Case), Query: `direction` (`OUT` \| `IN`) | Gợi ý đối soát hóa đơn VAT thông minh từ DB cho Vụ việc (Khớp Tiền + Số chứng từ/Lệnh quyết toán + Biển số xe + Tên khách/Nhà cung cấp + Cùng tháng) |
| `POST`| `/cases/:id/settlements` | `id`, Body: `{ bankTransactionId, settlementType, sourceChannel, category, amount, transDate, partnerName, note }` | Ghi nhận cấn trừ giao dịch dòng tiền (ERP hoặc ngoài sổ sách) |
| `PATCH`| `/cases/:id/settlements/:settlementId` | `id`, `settlementId`, Body: `{ amount?, category?, note?, transDate?, partnerName? }` | Cập nhật giao dịch cấn trừ ngoài sổ sách (`OFF_SYSTEM_MANUAL`), tự động cập nhật net-off hóa đơn liên kết nếu có và tính lại công nợ. Chặn sửa sao kê ngân hàng (`ON_SYSTEM`) |
| `DELETE`| `/cases/:id/settlements/:settlementId` | `id`, `settlementId` | Xóa bản ghi thu/chi dòng tiền khỏi vụ việc |

### 4.2. Nhóm Lợi Nhuận Gộp & Đối Soát Báo Cáo
| Method | Endpoint | Tham số / Body | Mô tả Nghiệp vụ |
| :--- | :--- | :--- | :--- |
| `GET` | `/cases/gross-profit-report` | `@BranchId()`, Query: `from`, `to` | Lấy báo cáo tổng hợp lợi nhuận gộp kèm chi tiết từng vụ việc và tính tổng hợp (`TongCong`), sắp xếp `ngayPhatSinh DESC` |
| `GET` | `/cases/by-code/:code/gross-profit` | `code` (`so_chung_tu` hoặc UUID `id`/`hd_phieu_dich_vu_id`) | Tra cứu nhanh chỉ số Doanh thu / Chi phí / Lợi nhuận theo mã vụ việc hoặc UUID (xử lý qua `KgaraCaseLookupService`) |
| `POST`| `/sync/gross-profit` | `@BranchId()`, Query/Body: `from`, `to` | Kích hoạt tác vụ đồng bộ lợi nhuận gộp từ KGara theo chi nhánh và khoảng ngày |
| `GET` | `/reports/gross-profit-detail` | `@BranchId()`, Query: `from`, `to` | Proxy gọi trực tiếp API báo cáo chi tiết lợi nhuận gộp từ máy chủ KGara |
| `GET` | `/reports/gross-profit-detail/journal` | `@BranchId()`, Query: `from`, `to`, `vuViecID` | Proxy lấy sổ nhật ký hạch toán chi phí/doanh thu chi tiết của vụ việc |
| `GET` | `/gross-profit/:id/linked-invoices` | `id` (UUID `kgara_gross_profit`) | Lấy danh sách hóa đơn điện tử đang liên kết với bản ghi lợi nhuận gộp này |
| `POST`| `/gross-profit/:id/linked-invoices` | `id`, Body: `{ invoiceId, linkType, note }` | Gắn liên kết một hóa đơn điện tử (đầu vào hoặc đầu ra) vào bản ghi lợi nhuận gộp |
| `DELETE`| `/gross-profit/:id/linked-invoices/:linkedId` | `id`, `linkedId` | Hủy liên kết hóa đơn khỏi bản ghi lợi nhuận gộp |

### 4.3. Nhóm Đồng Bộ & Sổ Kế Toán
| Method | Endpoint | Tham số / Header | Mô tả Nghiệp vụ |
| :--- | :--- | :--- | :--- |
| `GET` | `/cases/services` | `@BranchId()`, `page`, `pageSize`, `q`, `from`, `to`, `serviceType` (`ALL` \| `DV` \| `PT`), `filtersStr`, `sorts` | Lấy danh sách dòng chi tiết phụ tùng & công dịch vụ phân trang toàn hệ thống, lọc theo phân hệ `serviceType`, tính tổng cộng Grand Total và tổng lũy kế Cumulative |
| `GET` | `/cases/services/column-options` | `@BranchId()`, `column`, `search`, `page`, `pageSize`, `filtersStr`, `serviceType` | Lấy danh sách options phân trang distinct cho bộ lọc cột của bảng Chi tiết dòng dịch vụ & Phụ tùng |
| `GET` | `/cases/services/export/excel` | `branchId`, `from`, `to`, `serviceType`, `filtersStr`, `sorts`, `q` | Xuất file Excel bảng kê chi tiết phụ tùng và công thợ dịch vụ (`Chi_tiet_phieu_dich_vu_YYYYMMDD_HHmmss.xlsx`) |
| `POST`| `/sync/case-details` | `@BranchId()`, Query/Body: `from`, `to`, `force`, `concurrency` | Kích hoạt tác vụ đồng bộ hàng loạt (Batch Sync) chi tiết dòng phụ tùng & công thợ cho toàn bộ các vụ việc từ KGara API về ERP |
| `POST`| `/sync/all` | `@BranchId()` | Chạy chuỗi đồng bộ toàn diện: Chi nhánh -> Vụ việc -> Phải thu -> Phải trả |
| `POST`| `/sync/branches` | — | Đồng bộ danh mục chi nhánh từ KGara |
| `POST`| `/sync/cases` | `@BranchId()`, Query/Body: `from`, `to` | Đồng bộ toàn bộ vụ việc trong khoảng ngày (hỗ trợ cả Query lẫn Body) và thực hiện kiểm đếm xóa mềm |
| `POST`| `/sync/cases/incremental` | `@BranchId()` | Đồng bộ tăng dần các vụ việc thay đổi từ mốc watermark gần nhất |
| `POST`| `/sync/cases/:id/detail`| `@BranchId()`, `id` (`hd_phieu_dich_vu_id` \| `case.id` \| `so_chung_tu`) | Đồng bộ chi tiết dòng dịch vụ/phụ tùng cho một vụ việc cụ thể (tự động phân giải ID và đảo đúng thứ tự tham số client) |
| `POST`| `/sync/receivables` | `@BranchId()`, Query/Body: `from`, `to` | Đồng bộ sổ công nợ phải thu từ KGara |
| `POST`| `/sync/payables` | `@BranchId()`, Query/Body: `from`, `to` | Đồng bộ sổ công nợ phải trả theo TK 331 |
| `GET` | `/sync-runs` | `@BranchId()`, `take` (mặc định 50) | Lấy lịch sử nhật ký các lần chạy đồng bộ gần nhất |
| `GET` | `/receivables` | `@BranchId()` | Lấy danh sách công nợ phải thu đã đồng bộ |
| `GET` | `/payables` | `@BranchId()` | Lấy danh sách công nợ phải trả đã đồng bộ |
| `GET` | `/dashboard` | `@BranchId()`, `from`, `to` | Lấy dữ liệu tổng quan dashboard vụ việc trực tiếp từ KGara |

### 4.4. Nhóm Sổ Thu Chi Xưởng (Garage Cashflow)
Base Route: `/api/v1/greenway/cashflow`
| Method | Endpoint | Tham số / Body | Mô tả Nghiệp vụ |
| :--- | :--- | :--- | :--- |
| `GET` | `/` | Query: `page`, `pageSize`, `search`, `statusTab` (`all`, `receipt`, `payment`, `with_bank`, `no_bank`), `filtersStr`, `sorts`, `dateFrom`, `dateTo` | Lấy danh sách giao dịch thu/chi phát sinh thực tế tại xưởng kèm liên kết số phiếu dịch vụ và sao kê ngân hàng, tính stats (totalReceipts, totalPayments, netCashflow) |
| `GET` | `/column-options` | Query: `column`, `search`, `page`, `pageSize`, `filtersStr`, `statusTab` | Lấy danh sách distinct options phân trang cho popover lọc từng cột của bảng hoặc static master options |
| `POST`| `/` | Body: `CreateGarageCashflowDto` | Ghi nhận giao dịch thu/chi mới, tự động chuẩn hóa kênh nguồn `ON_SYSTEM` / `OFF_SYSTEM_MANUAL`, cập nhật tổng hợp vụ việc nếu có `caseId` |
| `PATCH`| `/:id` | `id`, Body: `UpdateGarageCashflowDto` | Cập nhật khoản thu/chi, tự động tính lại tổng thanh toán vụ việc cũ và mới |
| `DELETE`| `/:id` | `id` | Xóa giao dịch thu/chi và tính lại tổng thanh toán vụ việc |

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
2. Truy vấn các vụ việc trong DB của ERP cùng chi nhánh và khoảng ngày chưa bị đánh dấu xóa mềm (`kgara_deleted_at IS NULL`), **loại trừ các bản ghi có phân loại nghiệp vụ ghi nhận ngoài (`classification IN ('OJ', 'OJ_NGOAI')`)** để bảo vệ dữ liệu nội bộ không bị xóa nhầm.
3. Xác định các vụ việc có trong ERP nhưng không xuất hiện trong `syncedIds`.
4. Tăng bộ đếm `kgara_delete_count += 1`.
5. Nếu `kgara_delete_count >= 2`: Đánh dấu `kgara_deleted_at = now()`.
6. Nếu một vụ việc đã bị xóa mềm sau đó xuất hiện trở lại trong danh sách sync: Hệ thống tự động đặt lại `kgara_deleted_at = null` và `kgara_delete_count = 0` (Restoration).

### 5.4. Lịch Quét Tự Động 5 Mốc Giờ 2 Tháng Gần Nhất & Cảnh Báo An Toàn (`KgaraSyncScheduler`)
- Chạy tự động tại 5 mốc thời gian cố định: **`09:15`**, **`15:15`**, **`16:15`**, **`17:15`**, **`21:15`** (Asia/Ho_Chi_Minh).
- **Cơ chế lập lịch kép (Heartbeat 30s + @Cron)**:
  - Heartbeat `setInterval` (30s) trong `onModuleInit()` kiểm tra `isWithinSyncWindow()` với cửa sổ 45 phút giúp bù giờ nếu server khởi động lại trễ.
  - Decorator `@Cron('0 15 9,15,16,17,21 * * *')` làm lớp kích hoạt dự phòng song song với khóa slot `lastExecutedSlotKey` chống chạy lặp.
- **Cửa sổ đồng bộ 2 tháng gần nhất & Kéo chi tiết**:
  - Quét dữ liệu trong phạm vi 2 tháng gần nhất tính từ thời điểm chạy (`firstDayTwoMonthsAgo` đến `now`) cho tất cả chi nhánh.
  - Tự động gọi `syncCaseDetailsBatch` (`force: false`) nạp dòng phụ tùng & công thợ cho các vụ việc chưa có chi tiết.
- **Cảnh báo Thông minh Zero-Crash**:
  - Tra cứu người nhận thông báo an toàn thông qua quyền RBAC `CorePermission` (`resource IN ('garage', '*')`) và `CoreUserRole`. Bọc `try/catch` độc lập không làm gián đoạn luồng sync DB chính.
  - Gửi thông báo loại `WARNING` tới người dùng có quyền nếu vụ việc bị xóa đang có hóa đơn liên kết; gửi thông báo loại `INFO` nếu không có hóa đơn liên kết.

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
  - `linkType = 'IN'`: Hóa đơn mua phụ tùng, dầu nhớt, vật tư tiêu hao đầu vào cấu thành nên chi phí vụ việc (gắn với Bảng Chi Phí Vụ Việc).
  - `linkType = 'OUT'`: Hóa đơn điện tử VAT xuất cho khách hàng hoặc bên bảo hiểm tương ứng với doanh thu dịch vụ (gắn với Bảng Phải Thu & Phân Bổ).
- **Cột "HĐ đã cấn trừ" trên 2 Bảng Tài Chính**:
  - `QuoteReceivablesTable` (Phải thu KH & BH) và `QuoteCostTable` (Chi phí NCC & Thợ) đều hiển thị cột **"HĐ đã cấn trừ"** (`linkedInvoices`).
  - Mỗi badge hóa đơn hiển thị số HĐ kèm dot trạng thái:
    - 🟢 **Xanh lá (`Đã khớp sao kê`)**: Khi hóa đơn đã có cấn trừ dòng tiền thực tế qua sao kê ngân hàng / tiền mặt (`hasBankNetOff === true` hoặc `bankSettledAmount > 0`).
    - 🟡 **Vàng hổ phách (`Chưa khớp sao kê`)**: Hóa đơn đã gắn với vụ việc nhưng bản thân hóa đơn chưa được cấn trừ với giao dịch sao kê nào.
  - Khi chưa có HĐ nào cấn trừ: hiển thị dấu gạch ngang mờ (`—`).
- Ràng buộc toàn vẹn: Khi bản ghi `kgara_gross_profit` hoặc `kgara_cases` bị xóa, các dòng liên kết hóa đơn tương ứng sẽ tự động bị xóa theo (`onDelete: 'CASCADE'`), đảm bảo không để lại bản ghi mồ côi.

### 5.8. Quy tắc Quản lý Dòng tiền & Công nợ 100% trên ERP (`kgara_case_settlements` & `bank_transactions`)
- **Nguyên tắc nghiệp vụ dòng tiền**: Không sử dụng các trường thanh toán cũ trên máy chủ KGara để theo dõi thu/chi, vì trên thực tế KGara không quản lý tài khoản thu/chi thực tế của doanh nghiệp.
- **Preset Tab Priority Router khi Mở Drawer Thu/Chi Tiền (`CaseLinePaymentDrawer`)**:
  - Khi người dùng click nút Thu tiền hoặc Chi tiền trên từng dòng vụ việc:
    - **Ưu tiên 1 (`linked`)**: Nếu đã có hóa đơn cấn trừ cho dòng này (`linkedCount > 0`) ➔ Mở ngay tab **"Đã cấn trừ"** (`linked`).
    - **Ưu tiên 2 (`suggestions`)**: Nếu chưa có cấn trừ nhưng có hóa đơn gợi ý khớp (`suggestionsCount > 0`) ➔ Mở tab **"Gợi ý khớp"** (`suggestions`).
    - **Ưu tiên 3 (`all`)**: Chỉ khi không có cấn trừ và không có gợi ý (`linkedCount === 0 && suggestionsCount === 0`) ➔ Mới mở tab **"Tất cả"** (`all`).
    - **Lưu lựa chọn người dùng**: Khi người dùng tự tay click chọn preset tab khác (`setViewPreset`), trạng thái được ghi nhớ qua `userSelectedPresetRef` và không bị ghi đè bởi auto router.
- **Right Panel Cấn Trừ (`CaseLinePaymentRightPanel`)**:
  - Gồm 2 Section chuẩn hóa (`DrawerSection`, `DrawerRow`):
    - **Section 1: "Khoản mục cấn trừ"**: Phân loại, Mã, Tên, Bên thanh toán, và **Số tiền cần cấn trừ** (`targetAmount`).
    - **Section 2: "Thông tin sổ báo giá"**: Thông tin tổng quan vụ việc/báo giá (Số chứng từ, Biển số xe, Khách hàng, Hãng/Dòng xe, Trạng thái, Ngày tiếp nhận/phát sinh, Tổng tiền báo giá, Khách hàng TT / Bảo hiểm TT) kế thừa trực tiếp từ `caseData`.
- **Theo dõi 2 chiều dòng tiền thực tế thuần túy trên ERP (Pure Cashflow Standard)**:
  - **Tiến độ thanh toán & Công nợ (Đã thực chi, Đã thu thực tế, Còn phải chi trả, Còn phải thu)** **CHỈ TÍNH DUY NHẤT DỰA TRÊN CÁC GIAO DỊCH DÒNG TIỀN THỰC TẾ** trong bảng `kgara_case_settlements` (Sao kê ERP `ON_SYSTEM` và Tiền mặt sổ quỹ `OFF_SYSTEM_MANUAL`).
  - **Hóa đơn VAT liên kết (`erp_invoices`)**: Là chứng từ kế toán/thuế, **tuyệt đối KHÔNG cộng dồn tiền hóa đơn vào dòng tiền thực thu/thực chi** nếu không có giao dịch dòng tiền tương ứng.
  1. **Chiều Phải Thu (Doanh thu / Khách hàng)**:
     - Mục tiêu thu (`targetRevenue`): **Tổng tiền thanh toán có thuế** (`tienCoThue` / `TongTienThanhToan`), **tuyệt đối không fallback sang doanh thu chưa thuế** (`doanhThu`).
     - Đã thu thực tế (ERP): `totalCollected = directReceiptOnSystem + directReceiptOffSystem`.
     - Còn phải thu (`tienConPhaiThanhToan`): `Math.max(0, targetRevenue - totalCollected)`.
  2. **Chiều Phải Chi (Tổng chi phí vụ việc / Nhà cung cấp)**:
     - Mục tiêu chi: Tổng chi phí vụ việc (`ChiPhi` từ `kgara_gross_profit` hoặc `kgara_cases`).
     - Đã thanh toán (ERP): `totalPaid = directPaymentOnSystem + directPaymentOffSystem`.
     - Còn phải chi trả: `Math.max(0, targetCost - totalPaid)`.
- **Ma trận Quyền hạn Thao tác trên Dòng tiền & Chế độ Chỉnh sửa (RBAC Matrix)**:
  - `OFF_SYSTEM_MANUAL` (Sổ ngoài / Tiền mặt): Cho phép **Thêm**, **Sửa** (qua `PATCH /cases/:id/settlements/:settlementId`), và **Xóa**.
  - `ON_SYSTEM` (Sao kê ngân hàng / Sổ quỹ ERP): Cho phép **Thêm** và **Xóa**; **Chặn Sửa** trực tiếp (nút Sửa hiển thị mờ kèm Tooltip giải thích; Backend guard trả về `400 BadRequestException`).
  - `isViaInvoice` (Cấn trừ tự động từ Hóa đơn): **Khóa hoàn toàn** không cho Sửa/Xóa trực tiếp; hiển thị icon Khóa kèm Tooltip: _"Cấn trừ tự động từ hóa đơn liên kết. Để gỡ, hãy xóa liên kết hóa đơn tương ứng."_
  - **Quyền Thao tác Thu / Chi tiền (`canEditFinancial`)**: Các nút **"Thu tiền"** ("Thu KH", "Thu BH" trong bảng Phải thu) và **"Chi tiền"** (trong bảng Phụ tùng và Dịch vụ) chỉ hiển thị và cho phép click khi user có quyền sửa Hóa đơn (`INVOICES:update`) hoặc Sao kê / Sổ quỹ (`BANK_STATEMENTS:update` / `CASH_STATEMENTS:update`). Nếu không có quyền, cột hiển thị dấu gạch ngang (`---`) và chặn mọi trigger thanh toán.
  - **Quyền Bật/Tắt Chế độ Chỉnh sửa Vụ việc (`canUpdateGarage`)**: Chỉ người dùng có quyền `GARAGE:update` mới có thể chuyển đổi trạng thái chỉnh sửa (`editMode`), hiển thị nút "Chỉnh sửa" trên header Drawer hoặc kích hoạt edit mode từ các trigger ngoài bảng. Nếu thiếu quyền, Drawer luôn ở chế độ xem (`view`), nút "Chỉnh sửa" bị ẩn, và mọi lời gọi `startEdit()` đều bị chặn an toàn kèm thông báo lỗi.
  - **Bảo vệ Backend (`KgaraCaseFinancialController`)**: Áp dụng decorator `@RequireAnyPermissions` trên tất cả endpoints liên kết hóa đơn (`POST/DELETE linked-invoices`: `GARAGE:update` || `INVOICES:update`) và dòng tiền vụ việc (`POST/DELETE/PATCH settlements`: `GARAGE:create`/`update` || `INVOICES:update` || `BANK_STATEMENTS:update` || `CASH_STATEMENTS:update`).
- **API Tra cứu Lợi nhuận gộp theo mã (`GET /cases/by-code/:code/gross-profit`)**:
  - Trả về `ChiPhi`, `DoanhThu`, `LoiNhuan`, `BienLoiNhuan` (%), cùng các khoản phân rã (`GiaVonPhuTung`, `ChiPhiGiaCongNgoai`, `ChiPhiHoaHongGDV`, `ChiPhiHoaHongMG`).
  - Tự động fallback sang bảng `kgara_cases` để tính toán doanh thu/chi phí nếu vụ việc chưa có bản ghi gross profit riêng, đảm bảo UI Drawer và Bản in luôn có số liệu chuẩn xác.

### 5.9. Cơ chế Đồng bộ Cấn trừ Tự động 2 Chiều Toàn Diện (Full Bidirectional Net-Off & Settlement Sync)
- **Vụ việc → Hóa đơn**:
  - Khi thêm giao dịch Sao kê ngân hàng (`ON_SYSTEM`) vào vụ việc qua `addCaseSettlement`: Backend tự động tìm các Hóa đơn VAT liên kết đang có và tạo/cập nhật bản ghi cấn trừ `erp_invoice_voucher_netoff` tương ứng.
  - Khi cập nhật số tiền giao dịch (`updateCaseSettlement`): Backend tự động cập nhật lại `net_off_amount` trên các hóa đơn liên kết tương ứng.
  - Khi gỡ giao dịch Sao kê khỏi vụ việc qua `removeCaseSettlement`: Backend tự động dọn dẹp các bản ghi `erp_invoice_voucher_netoff` trên toàn bộ hóa đơn liên kết và tính lại công nợ.
- **Hóa đơn → Vụ việc**:
  - Khi cấn trừ Sao kê với Hóa đơn qua `linkInvoiceToTransaction` trong `TransactionAccountingService`: Backend tự động quét các vụ việc đang liên kết với hóa đơn đó (`kgara_case_linked_invoice`), tự động tạo/cập nhật `kgara_case_settlements` và cập nhật giảm công nợ `tien_con_phai_thanh_toan` của vụ việc.
  - Khi xóa/gỡ cấn trừ Sao kê khỏi Hóa đơn qua `removeInvoiceFromTransaction`: Backend tự động xóa settlement tương ứng trong `kgara_case_settlements` ở các vụ việc liên kết và tính lại công nợ.
- **Khi Liên kết Hóa đơn $\leftrightarrow$ Vụ việc (`addLinkedInvoice`)**:
  - Tự động đồng bộ 2 chiều: Nếu vụ việc đã có sao kê trước $\rightarrow$ cấn trừ sang Hóa đơn; Nếu Hóa đơn đã có sao kê trước $\rightarrow$ tự động tạo settlement cho vụ việc và tính lại số dư.
  - Khi gỡ liên kết (`removeLinkedInvoice`): Tự động dọn dẹp các cấn trừ chéo giữa 2 bên.
- **Gợi ý Đối soát Thông minh (`GarageSmartSettlementService`)**:
  - Khi tính `remainingAmount` trong gợi ý sao kê cho vụ việc, tự động loại trừ net-off của chính các hóa đơn liên kết với vụ việc đó (`invoice_id NOT IN (...)`), tránh việc sao kê đã full net-off cho hóa đơn bị ẩn khỏi danh sách gợi ý.
  - Tự động `LEFT JOIN` kiểm tra `already_settled` để sao kê đã là cấn trừ của vụ việc hiện tại luôn xuất hiện trong gợi ý (kèm cờ `alreadySettledForThisCase = true`, badge `ĐÃ CẤN TRỪ` và nút `Chọn lại cấn trừ`).

### 5.10. Quy tắc Gỡ liên kết Chứng từ trên Giao diện (Client-side Staging & Batch Save)
- Trong đồ thị mạng lưới chứng từ ([`DrawerDocumentTraceability`](file:///home/dev/repos/erp/erp-web/src/shared/components/drawer/DrawerDocumentTraceability/DrawerDocumentTraceability.tsx)), khi người dùng ở chế độ Chỉnh sửa (`editMode`) và bấm "Gỡ liên kết":
  - Hành động gỡ được ghi nhận vào trạng thái pending trên client (`pendingDeletedInvoiceIds`, `pendingDeletedSettlementIds`).
  - Cập nhật lạc quan trên đồ thị (xóa node và edge khỏi state cục bộ) và tính toán lại số tiền đã cấn trừ.
  - **Tuyệt đối không gọi API xóa ngay lập tức**; chỉ khi người dùng bấm **"Lưu thay đổi"** thì hệ thống mới gọi API gỡ bỏ hàng loạt.

### 5.11. Cơ chế Bộ Lọc Đa Chiều Nâng Cao (`__ALL_MATCHING__`, `__BLANK__` & Cascading Options)
- **Chuẩn Lọc Toàn Diện trên Bảng Garage Cases (`/cases`) & Sổ Công Nợ Khách Hàng (`/cases/customers-debt`)**:
  - `__ALL_MATCHING__` (Chọn tất cả kết quả tìm kiếm):
    - Khi ô tìm kiếm rỗng (`searchStr = ""`): Hệ thống hiểu là chọn toàn bộ dữ liệu $\rightarrow$ Không áp điều kiện lọc WHERE để giữ trọn vẹn tập dữ liệu.
    - Khi có từ khóa tìm kiếm: Sử dụng hàm chuẩn `applyMultiKeywordFilter` hỗ trợ tìm kiếm theo chuỗi con (`ILIKE`), tìm kiếm chính xác khi bọc dấu ngoặc kép (`"..."`), hoặc tìm kiếm nhiều từ khóa cách nhau bởi dấu chấm phẩy (`;`).
  - `__BLANK__` (Lọc giá trị trống / Null / 0): Xử lý kết hợp `(column IS NULL OR CAST(column AS TEXT) = '' OR column IN (...))` cho phép người dùng lọc đồng thời giá trị rỗng cùng với các tùy chọn cụ thể khác.
  - **Hỗ trợ Bộ Lọc 7 Cột / Tiêu Chí Trọng Tâm trên Bảng Phiếu Dịch Vụ**:
    - **Tab trạng thái (`statusTab`)**: Hỗ trợ lọc server-side theo 3 nhóm trạng thái chính trên thanh Pill Tabs:
      - `'quotation'`: Báo giá / Nháp / Chờ duyệt (`tinh_trang_dich_vu = 1` hoặc tên chứa `'báo giá'`, `'nháp'`, `'chờ'`).
      - `'in_progress'`: Đang thực hiện (`tinh_trang_dich_vu IN (0, 2)` hoặc tên chứa `'đang sửa'`, `'đang làm'`, `'tiếp nhận'`, `'đang xử lý'`, `'kiểm tra'`, `'sửa chữa'` và không thuộc trạng thái kết thúc/hủy).
      - `'completed'`: Hoàn tất / Đã giao xe (`tinh_trang_dich_vu = 3` hoặc tên chứa `'kết thúc'`, `'hoàn tất'`, `'hoàn thành'`, `'giao xe'`, `'xong'`, `'đã thanh toán'`).
    - **Ngày tiếp nhận (`caseDate` / `ngayTiepNhan`)**: Tích hợp Searchbox + Options distinct phân trang + Date Range Picker dải ngày từ - đến.
    - **Ngày kết thúc (`ngayHoanThanhCongViec`)**: Tích hợp Searchbox + Options distinct phân trang + Date Range Picker + Tùy chọn `(blank)` để lọc phiếu chưa kết thúc.
    - **Doanh thu (`doanhThu`)**: Tự động `LEFT JOIN` với bảng `kgara_gross_profit`, áp dụng `COALESCE("case"."doanh_thu", "gp"."doanh_thu")` (không fallback về `tien_co_thue` để tránh sai lệch doanh thu khi chưa hoàn thành), định dạng tiền tệ VNĐ và lọc `__BLANK__` (0 đ / Chưa có).
    - **Chi phí (`chiPhi`)**: Áp dụng `COALESCE("case"."chi_phi", "gp"."chi_phi")`, định dạng tiền tệ và lọc `__BLANK__`.
    - **Lợi nhuận (`loiNhuan`)**: Áp dụng `COALESCE("case"."loi_nhuan", "gp"."loi_nhuan", DoanhThu - ChiPhi)`, định dạng tiền tệ và lọc `__BLANK__`.
    - **Biên LN (`margin`)**: Tính toán tỷ lệ % margin tức thời và hỗ trợ 4 phân khúc chọn nhanh: `'HIGH'` ($\ge 50\%$), `'MID'` ($20\% - 50\%$), `'LOW'` ($0\% - 20\%$), `'NEGATIVE'` ($< 0\%$) cùng lọc `__BLANK__`.
  - **Cascading Column Options**: Endpoint `/cases/column-options` và `/cases/customers-debt/column-options` nhận tham số `filtersStr` để động hóa danh sách options phụ thuộc vào các cột khác đang được lọc.
  - **Float Action Bar & Quick Actions**: Cả bảng Phiếu dịch vụ (`GarageCases.tsx`) và bảng Danh sách phiếu dịch vụ trong Drawer Hồ sơ công nợ (`GarageCustomerDetailDrawer.tsx`) đều bố trí các Quick Actions thuận tiện:
    - 👁️ **Xem chi tiết** (`Eye` icon) $\rightarrow$ Mở Drawer ở chế độ View (`initialEditMode: false`, `quote_details`).
    - ✏️ **Chỉnh sửa** (`Pencil` icon) $\rightarrow$ Mở Drawer trực tiếp ở chế độ Edit (`initialEditMode: true`).
    - ⚖️ **Đối soát** (`Scale` icon trong Context Menu dòng bảng `GarageCasesTable`, `GarageCasePartnerTab`, `GarageCaseServicesSection`) $\rightarrow$ Mở Drawer chuyển thẳng vào tab **Tài chính (`financials`)** và kích hoạt sẵn chế độ chỉnh sửa (`editMode: true`), cho phép đối soát cấn trừ hóa đơn và dòng tiền tức thời.

### 5.12. Phân Hệ Thu Chi Xưởng Garage (Garage Cashflow Page & Drawer 2 Cột Chuẩn Hóa)
- **Kiến trúc Phân tách Mối quan tâm (Separation of Concerns)**:
  - Dòng tiền Thu/Chi thực tế tại xưởng được quản lý tập trung và độc lập tại **Page Thu Chi Xưởng** (`/garage-cashflow`), xây dựng theo chuẩn `SpreadsheetPageTemplate`, `/standardize-table`, và `/standardize-drawer`.
  - **Cơ chế Cấn trừ Trực tiếp (Direct Case Settlement)**: Mỗi dòng thu tiền khách/bảo hiểm (`RECEIPT`) hoặc chi tiền gia công/vật tư (`PAYMENT`) được cấn trừ trực tiếp cho 1 Số Phiếu Dịch Vụ (`so_chung_tu`), lập tức trừ giảm công nợ `tien_con_phai_thanh_toan` mà không bắt buộc phải chờ hóa đơn thuế hay sao kê ngân hàng đã nạp lên ERP.
  - **Sao kê Ngân hàng đóng vai trò THAM CHIẾU (Audit Reference)**: Cho phép gắn liên kết với dòng sao kê (`bank_transaction_id`) để đối soát kiểm toán, nhưng không trói buộc quy trình dòng tiền vào sao kê.
  - **Hóa đơn VAT quản lý độc lập**: Tránh nguy cơ logic cấn trừ 3 bên (HĐ $\leftrightarrow$ Sao kê $\leftrightarrow$ Phiếu dịch vụ) bị rối loạn khi có một khâu bị gỡ hay điều chỉnh.
- **Drawer 2 Cột Chuẩn Hóa (`GarageCashflowFormDrawer`)**:
  - Tuân thủ nghiêm ngặt `/standardize-drawer` (layout="2-columns", size="xl"):
    - **Cột trái (`GarageCashflowLeftForm`)**: Chọn loại giao dịch (Thu / Chi), Số tiền, Phương thức thanh toán (Chuyển khoản, Tiền mặt, POS, Khác), Ngày phát sinh, Người nộp/nhận, Mã biên lai/UNC, Chọn Phiếu dịch vụ cấn trừ, Chọn Sao kê tham chiếu, Ghi chú.
    - **Cột phải (`GarageCashflowRightSummary`)**: Tóm tắt thông tin Phiếu dịch vụ (Doanh thu, Đã thanh toán, Còn nợ hiện tại, Còn nợ dự kiến sau khi thu), Tóm tắt Sao kê tham chiếu, và các lưu ý nghiệp vụ.
- **Tích Hợp Thao Tác Nhanh trên Drawer Báo Giá (`QuoteFinancialsTabContent`)**:
  - Tại bảng Phải thu & Phải trả trong Drawer Báo giá: Bổ sung 2 nút thao tác nhanh `+ Thu tiền` (màu xanh emerald) và `+ Chi tiền` (màu hổ phách amber).
  - Khi click: Mở ngay `GarageCashflowFormDrawer` với các trường được điền sẵn (`fixedCaseId`, `fixedCaseCode`, `suggestedAmount`, `defaultType`), hoàn tất thu/chi trong 2 giây.
- **Backend Architecture & API Endpoints (`kgara-api-core`)**:
  - **Pattern A Sub-Controller**: `GarageCashflowController` (`/api/v1/kgara-api-core/cashflow`).
  - **Pattern B Sub-Service**: `GarageCashflowService`.
  - **Pattern C Pure Calc Engine**: `GarageCashflowCalcEngine` (tính toán KPI thống kê Tổng thu, Tổng chi, Net cashflow, và tái tính toán số dư công nợ).
  - Endpoints:
    - `GET /cashflow`: Danh sách phân trang, tìm kiếm đa từ khóa, bộ lọc theo ngày, theo loại, theo phương thức và trả về `stats: { totalReceipts, totalPayments, netCashflow, totalTransactions, linkedCasesCount }`.
    - `GET /cashflow/column-options`: Bộ lọc distinct options.
    - `POST /cashflow`: Tạo mới bản ghi thu/chi và tự động cập nhật công nợ phiếu dịch vụ.
    - `PATCH /cashflow/:id`: Chỉnh sửa bản ghi thu/chi và tái tính toán công nợ.
    - `DELETE /cashflow/:id`: Xóa giao dịch và hoàn nợ cho phiếu dịch vụ.
- **Database Entity Updates (`kgara_case_settlements`)**:
  - Bổ sung các cột: `payment_method`, `receipt_number`, `payer_type`.
  - Chuyển `case_id` thành nullable để hỗ trợ ghi nhận chi phí chung của xưởng không gắn với phiếu cụ thể.
  - Bổ sung composite indexes: `idx_kgara_settlements_trans_date`, `idx_kgara_settlements_payment_method`.
    - 🔗 **Liên kết hóa đơn trong Mã CT** (`Link2` icon trong `GarageCaseCodeCell`) $\rightarrow$ Mở tab Tài chính ở chế độ xem (`editMode: false`) để tra cứu.
    - 🔄 **Đồng bộ từ KGara** (`RefreshCw` icon) $\rightarrow$ Kích hoạt đồng bộ chi tiết vụ việc trực tiếp từ KGara.
    - 🔗 **Liên kết hóa đơn** (`Link2` icon) $\rightarrow$ Mở Drawer chọn và liên kết hóa đơn điện tử VAT đầu ra/đầu vào vào vụ việc ngay ngoài bảng.

### 5.12. Xử lý An Toàn ID Tạm Thời & Luồng Staging Thu/Chi Ngoài Sổ Sách (Off-System Manual Cashflow Staging)
- **Luồng Ghi nhận Thu/Chi Ngoài Sổ sách (`OFF_SYSTEM_MANUAL`) trong Tab Tài chính Drawer**:
  - Khi ở chế độ Chỉnh sửa (`editMode`), form "Ghi nhận Dòng tiền Ngoài sổ sách" cho phép nhập số tiền, kênh (Tiền mặt ngoài, CK Cá nhân, Khác), người nộp/nhận và ghi chú.
  - Nút **"Thêm vào danh sách"** (`handleAddManualToDraft`) đẩy giao dịch vào mảng bản nháp `pendingAddedSettlements` với `isPending: true`, tiền tố `tmp-...`, đồng thời tự động cập nhật ngay số dư công nợ/tiền đã thu trên client preview (`getActiveFinancialSummary`).
  - Giao diện bảng danh sách đã ghi nhận hiển thị badge trực quan **"Chờ lưu"** và cho phép xóa/hủy trước khi lưu.
  - Khi có ít nhất 1 khoản chờ lưu hoặc chỉnh sửa thuộc tính, nút chính **"Lưu thay đổi"** (`handleSaveAll`) ở footer drawer được kích hoạt (`totalHasPendingChanges = true`). Khi bấm lưu, hệ thống gọi batch `POST /cases/:id/settlements` để ghi nhận toàn bộ vào cơ sở dữ liệu.
- **Xử lý An toàn ID Tạm thời**:
  - Khi người dùng thêm mới giao dịch thu chi hoặc liên kết hóa đơn trên giao diện nhưng sau đó hủy hoặc gỡ bỏ trước khi lưu (ID có tiền tố `tmp-...` hoặc `manual-tmp-...`):
    - **Client-side (`useGarageCaseEditForm.ts`)**: Hàm `createClientId()` luôn sinh tiền tố `tmp-...`. Khi xóa item tạm thời, hàm `removeSettlement` và `removeLinkedInvoice` lọc bỏ các ID tạm thời, không bao giờ đẩy vào `pendingDeletedSettlementIds` hoặc `pendingDeletedInvoiceIds`.
    - **Backend-side (`kgara-api-core.controller.ts`)**: Các endpoint `DELETE /cases/:id/settlements/:settlementId` và `DELETE /cases/:id/linked-invoices/:invoiceId` tích hợp kiểm tra định dạng UUID regex (`/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i`). Nếu nhận được ID không phải UUID (ví dụ ID tạm), backend tự động bỏ qua an toàn và trả về `{ success: true, message: 'Ignored non-persisted temporary ID' }` thay vì gây lỗi 500 QueryFailedError của Postgres.

### 5.13. Quản Lý Công Nợ Đối Tác Garage (Khách Hàng & Nhà Cung Cấp) từ 07/2026
- **Mốc thời gian theo dõi**: Toàn bộ nghiệp vụ theo dõi công nợ đối tác xưởng Garage áp dụng mốc chặn dưới từ tháng 07/2026 (`>= 2026-07-01`).
- **Công nợ Khách hàng (`GET /cases/customers-debt`, `GET /cases/customers-debt/column-options`, `GET /cases/by-customer/:customerCode`)**:
  - **Quy tắc Phiếu Hoàn tất**: Dữ liệu công nợ khách hàng **chỉ tính toán và phản ánh các Phiếu dịch vụ đã kết thúc/hoàn tất** (`tinh_trang_dich_vu = 3` hoặc `ten_tinh_trang_dich_vu = 'Kết thúc'`). Các phiếu đang báo giá, tiếp nhận, đang sửa hoặc đã hủy được tự động loại trừ.
  - Dữ liệu được nhóm và tính toán tổng hợp trực tiếp từ bảng `kgara_cases` theo `khach_hang_code`.
  - Phân bổ 4 nhóm tuổi nợ (Aging buckets): `0_30` ngày, `31_60` ngày, `61_90` ngày, và `over_90` ngày dựa trên khoảng cách giữa ngày phát sinh phiếu (`ngay_phat_sinh`) và ngày hiện tại.
  - Hỗ trợ phân trang, tìm kiếm đa trường (`q`), lọc theo dải ngày (`from`, `to`), bộ lọc popover cột (`filtersStr`, `column_filters`), và sắp xếp theo doanh thu, đã thu, còn phải thu, tuổi nợ.
  - Tự động làm giàu dữ liệu và đồng bộ số dư `tien_da_thanh_toan`, `tien_con_phai_thanh_toan` từ bảng `kgara_case_settlements` khi thêm/xóa giao dịch cấn trừ và khi khởi tạo module (`onModuleInit`).
  - Bảo toàn số tiền đã cấn trừ trên ERP khi đồng bộ dữ liệu định kỳ từ KGara (`kgara-sync.service.ts`).
  - Giao diện Drawer "Hồ sơ công nợ khách hàng" (`GarageCustomerDetailDrawer.tsx`) chuẩn hóa theo `/standardize-table`, `variant="spreadsheet"`, kích thước cột tỉ lệ chuẩn kèm `minWidth={1210}`, các `DrawerSection` hỗ trợ collapsible, giới hạn chiều cao `max-h` kèm thanh cuộn mượt mà, và cột Tuổi nợ (Aging) trực quan đồng bộ 100% với trang `/garage-customers`.
- **Công nợ Nhà cung cấp (`GET /payables/suppliers-debt`)**:
  - Dữ liệu được nhóm và tổng hợp từ sổ công nợ phải trả `kgara_payables` (tài khoản theo dõi 331) theo `doi_tac_id`.
  - Tính toán số dư đầu kỳ (`dk_no`, `dk_co`), số phát sinh trong kỳ (`ps_no`: đã thanh toán, `ps_co`: mua hàng/dịch vụ), số dư cuối kỳ (`ck_co - ck_no` = `balance_amount`) và tuổi nợ.
  - Endpoint `GET /payables/suppliers-debt/column-options`: Phục vụ bộ lọc popover cho mã/tên nhà cung cấp và tài khoản.
  - Endpoint `GET /payables/by-supplier/:supplierId/cases`: Lấy chi tiết các bút toán phát sinh và tự động kết nối với các phiếu dịch vụ `kgara_cases` liên đới qua mã chứng từ `maSoVuViec = soChungTu`.

### 5.13. Chuẩn hóa Parse Ngày An toàn & Sắp xếp Thứ tự Vụ việc (`parseSafeDate` & Order Logic)
- **Hàm tiện ích `parseSafeDate`**:
  - Nhận diện và chuyển đổi an toàn các định dạng ngày từ KGara (`ISO`, `DD/MM/YYYY`, `DD-MM-YYYY`, `number timestamp`).
  - Tự động bỏ qua các chuỗi không hợp lệ như `"0001-01-01T00:00:00"`, `"1900-01-01"`, `"0NaN"`, `"null"`, `"undefined"`, trả về `null` thay vì `Invalid Date` để chống lỗi `500 QueryFailedError (0NaN-NaN-NaNTNaN:NaN:NaN.NaN+NaN:NaN)` khi TypeORM ghi xuống Postgres.
- **Quy tắc Sắp xếp Thứ tự Vụ việc Đồng bộ BE/FE**:
  - Mặc định ưu tiên sắp xếp:
    $$\text{case.ngayPhatSinh DESC (NULLS LAST)} \longrightarrow \text{case.ngayTiepNhan DESC (NULLS LAST)} \longrightarrow \text{case.soChungTu DESC} \longrightarrow \text{case.updatedAt DESC}$$
  - Hỗ trợ tham số query `sorts` linh hoạt đa cột (`+col` / `-col`).

---

## 6. Tích hợp Liên Module

- **`erp-invoices-core`**:
  - Cho phép người dùng liên kết chéo hóa đơn đầu vào mua phụ tùng (`IN`) hoặc hóa đơn đầu ra dịch vụ (`OUT`) với từng vụ việc / bản ghi lợi nhuận gộp qua bảng `kgara_case_linked_invoice`.
  - Tự động đồng bộ cấn trừ sao kê 2 chiều giữa vụ việc và hóa đơn.
- **`notifications`**:
  - Gửi thông báo real-time tới chuông thông báo người dùng và admin khi phát hiện bất thường về dữ liệu đồng bộ hoặc xóa phiếu.

---

## 7. Quy tắc Kiểm thử & Báo cáo Chất lượng (QC Mandate)

Khi chỉnh sửa `kgara-api-core`:
1. Chạy Type-check: `bun run check:ci`
2. Chạy Unit test: `bunx jest src/kgara-api-core/ --forceExit`
3. Xác minh migration `1780000000000-AddKgaraGrossProfit.ts`, `1785128452000-AddKgaraColumns.ts` và `1786414442074-LedgerCascade.ts`.

---

## 8. Kiến Trúc Dịch Vụ & Kết Xuất Báo Cáo Excel (`api-service-refactor`)

### 8.1. Cấu Trúc Facade & Sub-Services
Module tuân thủ nghiêm ngặt tiêu chuẩn `api-service-refactor` (Pattern B + Pattern C) và Clean DI Constructor (1 signature duy nhất, không overload, không union type):
- **Query Facade (`KgaraCaseQueryService`)**: Service facade giữ nguyên 100% method signatures, delegate sang các Sub-services.
- **Export Facade (`KgaraCaseExportService` - 42 dòng)**: Service facade tinh gọn điều phối xuất Excel, delegate sang các Sub-services:
  - `KgaraCompletedCasesExportService` (~250 dòng): Quản lý truy vấn dữ liệu vụ việc, sổ thanh toán thực tế (`kgara_case_settlements`), hóa đơn liên kết và dòng chi tiết để xây dựng workbook 3 sheets chuyên nghiệp.
  - `KgaraCaseServicesExportService` (~140 dòng): Chuyên trách xuất bảng kê chi tiết dịch vụ & phụ tùng độc lập (`exportCaseServicesExcel`).
- **Pure Helpers & Sheet Builders (Pattern C)**:
  - `kgara-completed-cases-sheet.builder.ts`: Sheet rendering engine chuyên trách dựng 3 sheets (Sheet 1: Bảng kê kết thúc & công nợ hai chiều Thu/Trả P1, Sheet 2: Theo dõi PnL phân tích lợi nhuận, Sheet 3: Chi tiết DV & Phụ tùng).
  - `kgara-excel-style.helper.ts`: Pure styling engine (`applyStandardExcelReportLayout`, `initSheetStructure`, `COMPLETED_CASES_COLUMNS`, `CASE_PNL_COLUMNS`, `COMPLETED_CASE_SERVICES_COLUMNS`, `CASE_SERVICES_EXPORT_COLUMNS`).
  - `kgara-case-filter.helper.ts`: Pure SQL mapping và query filter parsers (`applyCaseListFilters`, `applyCaseServiceFilters`, `getCaseColumnSelectExpr`, `getCaseServiceColumnSelectExpr`).

### 8.2. Cấu Trúc Báo Cáo Excel Chuẩn Hóa (3 Sheets & 6 Dải Màu Biên LN Tương Phản Cao)
Hàm xuất Excel `exportCompletedCasesExcel` sinh file XLSX gồm 3 sheets:
- **Sheet 1: `Bảng kê phiếu kết thúc` (23 cột - 2 Cột Ghi chú Thu & Trả riêng biệt & Phân tầng màu Biên LN)**:
  - Cụm Phải thu: `Phải thu (VNĐ)` (J), `Đã thu (VNĐ)` (K), `Còn lại phải thu (VNĐ)` (L, formula `=J{r}-K{r}`).
  - **Cột Ghi chú thu (M)**: Nằm ngay bên phải cột Còn lại phải thu, fill background màu kem/pastel amber dịu mắt (`#FFFFFBEB`), phục vụ ghi chú lý do công nợ khách hàng (chờ bảo hiểm duyệt, đối soát...).
  - Cụm Phải trả: `Phải trả (VNĐ)` (N), `Đã trả (VNĐ)` (O), `Còn lại phải trả (VNĐ)` (P, formula `=N{r}-O{r}`).
  - **Cột Ghi chú trả (Q)**: Nằm ngay bên phải cột Còn lại phải trả, fill background màu kem/pastel amber dịu mắt (`#FFFFFBEB`), phục vụ ghi chú lý do công nợ thợ/nhà cung cấp (chờ hóa đơn đầu vào, bảo hành...).
  - Cụm P&L nhanh: `Doanh thu (VNĐ)` (R), `Chi phí / Giá vốn (VNĐ)` (S), `Lợi nhuận gộp (VNĐ)` (T, formula `=R{r}-S{r}`).
  - **Biên LN (%) (U)**: Formula `=IF(R{r}>0, T{r}/R{r}, 0)`, tự động áp dụng hàm `styleMarginCell` đồng bộ 6 dải màu tương phản cao như Sheet 2.
  - Tham chiếu: `Hóa đơn VAT liên kết` (V), `Chi nhánh` (W).
- **Sheet 2: `Theo dõi lãi lỗ` (15 cột - Phân 6 Dải Màu Biên LN Tương Phản Cao)**:
  - Bóc tách: Doanh thu Công DV (G), Doanh thu Phụ tùng (H), Tổng Doanh thu (I, formula `=G{r}+H{r}`), Giá vốn Phụ tùng (J), Chi phí thợ / Khác (K), Tổng Chi phí (L, formula `=J{r}+K{r}`), Lợi nhuận gộp (M, formula `=I{r}-L{r}`).
  - **Biên LN (%) (N)**: Formula `=IF(I{r}>0, M{r}/I{r}, 0)`, tự động phân bổ 6 dải màu tương phản cao, triệt tiêu na ná màu:
    1. Lỗ ($< 0\%$): Đỏ Red-200 (`#FECACA` / chữ đỏ đậm `#991B1B`).
    2. Hòa vốn / Rất thấp ($0\% - 20\%$): Cam hổ phách Orange-200 (`#FED7AA` / chữ cam đất `#9A3412`).
    3. Trung bình ($20\% - 40\%$): Xanh da trời tươi Sky-200 (`#BAE6FD` / chữ xanh dương `#0369A1`).
    4. Khá / Tốt ($40\% - 60\%$): Xanh lá mạ Green-200 (`#BBF7D0` / chữ xanh lá đậm `#15803D`).
    5. Rất cao ($60\% - 80\%$): Xanh mòng két Teal-200 (`#99F6E4` / chữ xanh đậm `#0F766E`).
    6. Xuất sắc / Siêu LN ($\ge 80\%$): Tím phong lan Purple-200 (`#E9D5FF` / chữ tím đậm `#6B21A8`).
  - Tham chiếu: `Chi nhánh` (O) - Đã loại bỏ cột O Đánh giá PnL riêng biệt.
- **Sheet 3: `Chi tiết DV & Phụ tùng` (20 cột)**: Bảng kê chi tiết từng dòng công việc và phụ tùng theo vụ việc.
- **Hàng Tổng**:
  - **Row 1**: `TỔNG CỘNG (SUM)` với công thức `=SUM(...)` trên toàn bộ tập dữ liệu.
  - **Row 2**: `TỔNG THEO BỘ LỌC (SUBTOTAL)` với công thức `=SUBTOTAL(9, ...)` tự động tính lại khi lọc cột trong Excel.
  - **Views**: Frozen 4 dòng đầu (`ySplit: 4`), kích hoạt `autoFilter` từ Row 4.

---

## 9. Kiến Trúc Giao Diện Frontend: Sổ Báo Giá Drawer & Tab Tài Chính Chuẩn Hóa (`erp-web`)

### 9.1. Phân Tầng Tab Tài Chính & Khối Chuẩn Hóa (`QuoteFinancialsTabContent` & Right Panel)
Trong Tab Tài chính (`GarageCaseFinancialsTab`), cấu trúc được chuẩn hóa theo mô hình Pure Cashflow Standard, Unified Financial Tree, `/standardize-table` và `/ui-atomic-refactor`:

1. **Bảng 1: Phải thu & Cấn trừ (`QuoteReceivablesTable`)** — Luôn nằm đầu tiên:
   - **DrawerSection**: Tiêu đề chuẩn hóa `1. Bảng Phải thu & Cấn trừ` (icon `Landmark`, text-primary).
   - **Kiến trúc Unified Financial Tree**: Dùng chung các component nguyên tử với Bảng 2 (`FinancialTreeParentRow`, `FinancialTreeChildRow` từ `financial-tree-rows`).
   - Dòng cha mục tiêu: Hiển thị Tổng phải thu vụ việc, số tiền đã thu, còn lại và nút `[Thu tiền]` (hoặc tách `[Thu KH]` / `[Thu BH]` nếu có bảo hiểm duyệt).
   - Các dòng con cấn trừ `↳`: Hiển thị hóa đơn đầu ra (OUT) và phiếu thu tiền / sao kê ngân hàng.
   - **Kiểm soát nút Xóa theo Edit Mode**: Nút Xóa (thùng rác) chỉ active khi ở Chế độ chỉnh sửa (`editMode === true` và có đủ quyền). Khi ở chế độ xem, nút Xóa bị **Inactive / Disabled** (`opacity-30 cursor-not-allowed`) kèm tooltip *"Cần bật Chế độ chỉnh sửa để thao tác."*.

2. **Bảng 2: Phải trả & Cấn trừ (`QuoteCostTable` / `QuoteCostSummarySection`)**:
   - **DrawerSection**: Tiêu đề chuẩn hóa `2. Bảng Phải trả & Cấn trừ` (icon `Wallet`, text-amber-600).
   - **Trích xuất giá trị trường Chi phí mục tiêu**: Lấy trực tiếp từ field `ChiPhi` (`caseData?.chiPhi ?? caseData?.rawData?.ChiPhi ?? grossProfit?.ChiPhi ?? 0`), **tuyệt đối không cộng dồn giá vốn phụ tùng + nhân công**.
   - Dòng cha mục tiêu: Tiêu đề chuẩn hóa `Tổng phải trả vụ việc`, hiển thị số tiền mục tiêu, số tiền đã chi, còn lại và nút `[Chi tiền]`.
   - Các dòng con cấn trừ `↳`: Hiển thị hóa đơn đầu vào (IN) và phiếu chi tiền / sao kê ngân hàng.
   - Nút Xóa ở các dòng con cấn trừ đồng bộ hành vi: chỉ active khi ở Chế độ chỉnh sửa (`editMode === true`).

3. **Cột Phải Drawer Tinh Giản & Đồng Bộ Hoàn Hảo (`GarageCaseFinancialsRightPanel`)**:
   - **Section 1: Thông tin chung**: Bổ sung icon chuẩn trung tính `<Info className="w-3.5 h-3.5 text-muted-foreground" />` (không màu mè, đồng bộ ở cả `ReconciliationRightPanel` và `GarageCaseGeneralInfoSection`).
   - **Section 2: Hiệu quả kinh doanh & Lợi nhuận (`GarageCaseBusinessPerformanceSection`)**: Thay thế hoàn toàn section "Hiệu quả lợi nhuận gộp" cũ bằng `GarageCaseBusinessPerformanceSection` (kế thừa trực tiếp cấu trúc từ tab Chi tiết, nhận `caseData` và `grossProfit`). Header bổ sung icon `<TrendingUp className="w-3.5 h-3.5 text-muted-foreground" />` không màu mè. Hiển thị đầy đủ Doanh thu (chưa thuế), Tổng chi phí vụ việc (kèm breakdown giá vốn, gia công, hoa hồng nếu có), Lợi nhuận gộp và Biên lợi nhuận.
   - Tuân thủ **No Blue Mandate**: Toàn bộ UI tuân thủ hệ màu chuẩn `primary`, `slate`, `amber`, `emerald` và `rose`.

### 9.2. Drawer Cấn Trừ Dòng Chi Tiết Phải Thu / Phải Chi (`CaseLinePaymentDrawer`)
- Tuân thủ tiêu chuẩn `/standardize-drawer` và `/ui-atomic-refactor`:
  - Thành phần cốt lõi: `StandardFormDrawer`, `layout="2-columns"`, `size="xl"`.
  - Header: Tiêu đề kèm tên/mã dòng, `titleExtra` hiển thị:
    - Badge số tiền mục tiêu và badge bên thanh toán / chịu phí (Khách hàng / Bảo hiểm / Garage).
    - Nút **"Đang chọn" (`CaseLinePaymentSelectedButton`)**: Tách biệt khỏi PillTabs, hiển thị ngay trên header cùng hàng bên phải tiêu đề khi `selectedCount > 0` (ẩn khi = 0 theo Phương án A). Hỗ trợ click toggle kích hoạt bộ lọc xem các mục đang chọn.
  - Cột trái: Hệ thống 2 Sub-Tabs điều hướng linh hoạt theo chiều nghiệp vụ:
    - **Tab 1: "1. HĐ Đầu ra" (Thu tiền) / "1. HĐ Đầu vào" (Chi tiền)**: Tích hợp bảng HĐ điện tử kèm bộ lọc `PillTabs` (`CaseLinePaymentPresetBar`) với 3 tabs thuần túy phân loại nguồn dữ liệu: `Đã cấn trừ` (`linked`) ➔ `Gợi ý khớp` (`suggestions`) ➔ `Tất cả` (`all`). Thứ tự ưu tiên auto-active tự động chọn tab đầu tiên có dữ liệu.
    - **Tab 2: "2. Thu ngoài sổ" / "2. Chi ngoài sổ" (`ManualCashflowTabContent`)**: Cho phép ghi nhận thu/chi tiền mặt hoặc ngoài sổ trực tiếp.
  - Cột phải: `CaseLinePaymentRightPanel` gồm 2 Section chuẩn hóa (`DrawerSection`, `DrawerRow`):
    - **Section 1: "Khoản mục cấn trừ"**: Phân loại, Mã, Tên, Bên thanh toán / chịu phí, và **Số tiền cần cấn trừ**.
    - **Section 2: "Thông tin sổ báo giá"**: Thông tin tổng quan vụ việc/báo giá (Số chứng từ, Biển số xe, Khách hàng, Hãng / Dòng xe, Trạng thái, Ngày phát sinh, Tổng tiền báo giá, Khách hàng TT / Bảo hiểm TT) dùng `DrawerSection` (collapsible, icon `FileSpreadsheet`).
  - **Cơ chế Draft-First Frontend Save Flow**:
    - Khi người dùng chọn HĐ cấn trừ hoặc nhập thu/chi ngoài sổ và bấm "Lưu cấn trừ" / "Ghi nhận", hệ thống **CHỈ LƯU VÀO STATE Ở FRONTEND** (`useGarageCaseEditForm` thông qua callbacks `onAddInvoice`, `onRemoveInvoice`, `onAddSettlement`, `onRemoveSettlement`), đóng drawer con mà **không gọi API và không invalidate queries**.
    - Chỉ khi người dùng bấm **"Lưu thay đổi"** tại Drawer Sổ báo giá (`GarageCaseStandaloneDrawer`), toàn bộ thay đổi mới được gọi API batch save xuống cơ sở dữ liệu.
  - **Phân rã Atomic Kiến trúc (< 180 LoC per file)**:
    - `CaseLinePaymentDrawer.tsx` (112 LoC)
    - `useCaseLinePaymentTabs.tsx` (118 LoC)
    - `useCaseLinePaymentActions.ts` (75 LoC)
    - `CaseLinePaymentSelectedButton.tsx` (55 LoC)
    - `CaseLinePaymentPresetBar.tsx` (67 LoC)
    - 100% co-located Vitest tests pass và No Blue Mandate.


### 9.3. Tối Giản Tab Chi Tiết & Bổ Sung Thông Tin Bảo Hiểm (`GarageCasePreview`)
- Tab Chi tiết chuyển hẳn sang chế độ **Document Mode** (bản in PDF báo giá kỹ thuật số):
  - Loại bỏ hoàn toàn switch `Bảng dữ liệu` / `Bản in` khỏi tab Chi tiết (vì bảng dữ liệu đã chuyển sang Tab Tài chính).
  - Khối bảng in tài liệu (`QuoteDocumentTables`): Tự động phát hiện khi vụ việc có bảo hiểm (`hasInsuranceParts` / `hasInsuranceServices`), tự động bổ sung cột **BH duyệt** và hàng tổng kết **Tổng BH duyệt chi trả** riêng biệt cho từng khối phụ tùng và nhân công.

### 9.4. Cơ Chế Làm Giàu Giá Vốn Phụ Tùng (Cost Enrichment) & Phân Rã Kiến Trúc Atomic Bảng Sổ Báo Giá

#### 1. Thách thức kỹ thuật từ KGara API
- Endpoint `/api/v1/gr/cases/detail` của KGara trả về `GiaVonPhuTung = 0` trên 100% dòng (ngay cả các ca đã kết thúc và phát sinh giá vốn lớn như `GR-PDV2609-0056` hay `GR-PDV2609-0074`).
- Tuy nhiên, KGara lưu trữ chi tiết hạch toán giá vốn trong **Sổ nhật ký chi phí** (`/api/v1/gr/reports/gross-profit-detail/journal`).

#### 2. Thuật toán làm giàu giá vốn 3 tầng (`KgaraCostEnricherHelper`)
- Khi người dùng mở xem vụ việc trên ERP (`findCaseByCodeOrId`), nếu vụ việc đã hoàn tất hoặc có số liệu lãi gộp:
  1. Hệ thống tự động fetch Sổ nhật ký chi phí (`journal items`) của vụ việc.
  2. **Tầng 1 - Vốn Phụ tùng Xuất kho (`TK 1541 / TK 152`)**: Bóc tách từ các Phiếu xuất kho (`GR-PX...`). Tự động chuẩn hóa chuỗi tên (loại bỏ tag biển số xe `[51M80574] - [...]`), khớp tên và số lượng với từng dòng phụ tùng, tự động tính:
     $$\text{GiaVonPhuTung} = \text{round}\left(\frac{\text{ChiPhi}}{\text{SoLuong}}\right), \quad \text{TongVon} = \text{ChiPhi}$$
  3. **Tầng 2 - Vốn Gia công / Dịch vụ Mua ngoài (`TK 1542 / TK 331`)**: Gom vào `outsourceCost`.
  4. **Tầng 3 - Hoa hồng Môi giới / Chi phí khác (`TK 1543 / TK 335`)**: Gom vào `commissionCost`.
  5. Tự động cập nhật `giaVonPhuTung` vào `rawData.ListPhieuDichVuChiTiet` và lưu trữ trong bảng `kgara_case_services`.

#### 3. Phân rã kiến trúc Atomic Bảng Sổ Báo Giá (`/ui-atomic-refactor`)
Nhằm kiểm soát độ phức tạp mã nguồn (< 180 LoC per file, No Blue Mandate, 100% i18n, Co-located Vitest), file `QuoteDocumentTables.tsx` (trước đây 321 LoC) đã được phân rã thành:
1. **`QuotePartsDocumentTable`** (`quote-parts-document-table/`):
   - Kích thước: ~136 LoC.
   - Hiển thị đầy đủ cột **ĐG vốn** và **Tổng vốn**. Nếu có giá vốn xuất kho: hiển thị `formatNumber(row.unitCost)`; nếu chưa phân bổ (do mua ngoài gộp): hiển thị `---`.
   - Footer: Dòng cộng tổng tiền bán, tổng vốn phụ tùng, và dòng **Lãi gộp phụ tùng** ($\text{Doanh thu PT} - \text{Vốn PT}$) kèm biên lợi nhuận %.
2. **`QuoteServicesDocumentTable`** (`quote-services-document-table/`):
   - Kích thước: ~104 LoC.
   - Hiển thị bảng công thợ / dịch vụ kèm kỹ thuật viên phụ trách và tổng cộng.
3. **`QuoteDocumentCostSummary`** (`quote-document-cost-summary/`):
   - Kích thước: ~60 LoC.
   - Hiển thị khối đối soát 3 tầng chi phí minh bạch đối ứng với Sổ chi phí KGara:
     - 1. Phụ tùng kho (1541)
     - 2. Mua ngoài/DV (1542)
     - 3. Hoa hồng/Khác (1543)
     - Tổng chi phí vụ việc & Badge Lãi gộp toàn vụ việc.
4. **`QuoteDocumentTables`** (Container): Thu gọn từ 321 LoC xuống chỉ còn **52 LoC**, kết nối các sub-components sạch sẽ.

### 9.5. Kiến Trúc Cây Phân Cấp (Tree Table) Cho Bảng Phải Thu & Bảng Chi Phí Vụ Việc (`/ui-atomic-refactor`)

Nhằm mang lại trải nghiệm kế toán trực quan và đồng nhất giữa thu và chi theo luồng Draft-First:
1. **Thống Nhất Mô Hình 1 Dòng Cha Mục Tiêu (Unified Parent Target Row)**:
   - **Bảng Phải Thu (`QuoteReceivablesTable`)**: Thay vì hiển thị tách 2 dòng độc lập, bảng hiển thị duy nhất 1 dòng cha tổng mục tiêu `Tổng phải thu vụ việc` (`tienCoThue`).
     - Khi vụ việc có bảo hiểm (`tienThanhToanBh > 0`): Dòng cha hiển thị subtitle tag phân bổ `(KH: ... ₫ • BH: ... ₫)` và cung cấp 2 nút thanh toán `[Thu KH]` và `[Thu BH]`.
     - Khi vụ việc không có bảo hiểm: Hiển thị nút thanh toán duy nhất `[+ Thu tiền]`.
   - **Bảng Chi Phí (`QuoteCostTable` / `QuoteCostSummarySection`)**: Hiển thị duy nhất 1 dòng cha tổng mục tiêu `Tổng chi phí vụ việc` (`totalCost`), hiển thị tiến độ Đã chi vs Còn lại, cùng nút hành động `[+ Chi tiền]`.
2. **Các Dòng Con Thụt Lề Cấn Trừ (Indented Child Rows `↳`)**:
   - Khi có hóa đơn liên kết hoặc phiếu thanh toán/sao kê đã cấn trừ, các dòng con sẽ tự động hiển thị bên dưới dòng cha với icon cong `↳` (`CornerDownRight`).
   - Cột `% Tổng` trực quan: Thể hiện tỷ lệ phần trăm từng dòng cấn trừ so với số tiền mục tiêu của dòng cha.
   - Icon nhận diện loại chứng từ: Hóa đơn điện tử (🧾), Tiền mặt (💵), Chuyển khoản sao kê (🏦).
   - Tag trạng thái `Chờ lưu` cho các khoản vừa gán nháp ở client.
   - Nút Thùng rác đỏ xóa/gỡ cấn trừ trực tiếp trên từng dòng con khi ở chế độ chỉnh sửa.
3. **Phân Rã Atomic & Tuân Thủ Chuẩn Mực (`/ui-atomic-refactor`)**:
   - Tầng Molecules dùng chung trong `components/tables/financial-tree-rows/`:
     - `FinancialTreeParentRow.tsx` (159 LoC) & `FinancialTreeParentRow.test.tsx` (112 LoC).
     - `FinancialTreeChildRow.tsx` (108 LoC) & `FinancialTreeChildRow.test.tsx` (57 LoC).
   - Tầng Business Helpers:
     - `FinancialTreeReceivables.helper.ts` (121 LoC) & tests (147 LoC).
     - `FinancialTreeCost.helper.ts` (96 LoC).
   - Tầng Organisms & Sections:
     - `QuoteReceivablesTable.tsx` (123 LoC) & tests (171 LoC).
     - `QuoteCostTable.tsx` (87 LoC) & `QuoteCostSummarySection.tsx` (66 LoC).
   - 100% file < 160 LoC (đảm bảo khống chế < 180 LoC), 0 vi phạm No Blue Mandate, 100% i18n qua `t()`, 100% unit tests pass.

### 9.6. Chuẩn Hóa Cột Bảng Phiếu Dịch Vụ: Tách Cột Phải Thu KH / BH & Sắp Xếp Nhóm Tài Chính (`GarageCasesTable`)

Nhằm hỗ trợ nghiệp vụ đối soát công nợ chuyên sâu của kế toán và phân tách nguồn tiền thanh toán giữa Khách hàng và Đơn vị Bảo hiểm:
1. **Tách 2 Cột Phải Thu Riêng Biệt (`phaiThuKhachHang` & `phaiThuBaoHiem`)**:
   - **Phải thu Khách hàng (`phaiThuKhachHang`)**: Tiền dịch vụ/phụ tùng khách hàng chịu trách nhiệm thanh toán (`TienThanhToanKH`). Nếu xe không làm bảo hiểm (`XeLamBaoHiem = false`), toàn bộ tiền có thuế (`tienCoThue`) được tính cho khách hàng. Nếu xe làm bảo hiểm (`XeLamBaoHiem = true`), số tiền = $\max(0, \text{tienCoThue} - \text{bh})$.
   - **Phải thu Bảo hiểm (`phaiThuBaoHiem`)**: Tiền do công ty bảo hiểm duyệt chi trả (`TienThanhToanBH` hoặc fallback `TienBaoHiemDuyet`). Nếu xe không làm bảo hiểm, mặc định bằng 0.
   - Hỗ trợ đầy đủ: Định dạng tiền tệ `money(...)`, lọc giá trị distinct options server-side, sắp xếp sort 2 chiều và dòng cộng tổng kết trang/lũy kế (`SubtotalSummaryCell`).
2. **Cấu Hình Preset & Tách Cột Mặc Định Cả 2 View**:
   - Cả hai chế độ xem **Tổng quan** (`overview`) và **Đối soát** (`audit`) đều mặc định hiển thị 2 cột tách biệt `phaiThuKhachHang: true` và `phaiThuBaoHiem: true`, đồng thời ẩn cột gộp `collectionProgress: false`. Người dùng vẫn có thể chủ động bật lại cột gộp trong Drawer *Tùy chỉnh cột* khi cần xem thanh tiến độ tổng.
3. **Thứ Tự Cột Động Theo Chế Độ Xem (Dynamic Column Order)**:
   - **View Tổng quan (`overview`)**: Nhóm kết quả kinh doanh (**Doanh thu**, **Chi phí**, **Lợi nhuận**, **Biên LN**) được ưu tiên hiển thị **PHÍA TRƯỚC** các cột phải thu/phải trả:
     $$\text{STT} \rightarrow \text{Ngày tiếp nhận} \rightarrow \dots \rightarrow \text{Chi nhánh} \rightarrow \mathbf{Doanh\ thu} \rightarrow \mathbf{Chi\ phí} \rightarrow \mathbf{Lợi\ nhuận} \rightarrow \mathbf{Biên\ LN}$$
     $$\rightarrow \mathbf{Phải\ thu\ KH} \rightarrow \mathbf{Phải\ thu\ BH} \rightarrow \text{Còn phải thu} \rightarrow \text{Tổng phải trả} \rightarrow \text{Còn phải trả} \rightarrow \text{Cờ BH} \rightarrow \text{Cờ HĐ VAT}$$
   - **View Đối soát (`audit`) (và các view khác)**: Khối tiến độ thu/trả được ưu tiên hiển thị **TRƯỚC**, các cột kết quả kinh doanh nằm phía sau cột Còn phải trả (`tienConPhaiChi`):
     $$\text{STT} \rightarrow \text{Ngày tiếp nhận} \rightarrow \dots \rightarrow \text{Chi nhánh} \rightarrow \mathbf{Phải\ thu\ KH} \rightarrow \mathbf{Phải\ thu\ BH} \rightarrow \text{Còn phải thu} \rightarrow \text{Tổng phải trả} \rightarrow \text{Còn phải trả}$$
     $$\rightarrow \mathbf{Doanh\ thu} \rightarrow \mathbf{Chi\ phí} \rightarrow \mathbf{Lợi\ nhuận} \rightarrow \mathbf{Biên\ LN} \rightarrow \text{Cờ BH} \rightarrow \text{Cờ HĐ VAT}$$




4. **Bật Cột Ngày Tiếp Nhận & Ngày Kết Thúc trong View Đối Soát (`audit`)**:
   - Mặc định bật `caseDate: true` và `ngayHoanThanhCongViec: true` trong `AUDIT_GARAGE_CASE_COLUMN_VISIBILITY` tại `garageCaseViewPresets.ts`. Hiển thị ở đầu bảng ngay sau cột STT `#`.
5. **Chuẩn Hóa Kích Thước Cột (`Column Sizes`) & App Tooltip Chống Tràn Chữ**:
   - `caseDate` (Ngày tiếp nhận): `130px`.
   - `ngayHoanThanhCongViec` (Ngày kết thúc): `130px`.
   - `caseCode` (Số chứng từ): `180px`.
   - `customer` (Khách hàng): `200px`.
   - `kgaraClassification` (Phân loại KGara): `150px` (bọc `Tooltip` chống tràn nội dung).
   - `classification` (Phân loại nghiệp vụ): `150px` (button trigger `w-[136px]` + `Tooltip`).
   - `exclusionRules` (Quy tắc loại trừ): `150px` (button trigger `w-[136px]` + `Tooltip`).
   - `statusName` (Trạng thái dịch vụ): `130px`.
   - Các cột số tiền (`doanhThu`, `chiPhi`, `loiNhuan`, `collectionProgress`, `phaiThuKhachHang`, `phaiThuBaoHiem`, `tienConPhaiThanhToan`, `costProgress`, `tienConPhaiChi`): đồng bộ `140px`.
6. **Di Chuyển Icon Liên Kết Hóa Đơn (`Link2`) sang Cột HĐ VAT (`hasInvoice`)**:
   - Gỡ bỏ icon `Link2` khỏi `GarageCaseCodeCell` để ô số chứng từ hiển thị gọn gàng, không bị nghẽn thông tin.
   - Đưa vào cột `hasInvoice` (`100px`): Khi `totalLinked > 0`, render button `Link2` kèm Tooltip chi tiết (`x HĐ bán ra, y HĐ mua vào`) và click mở Drawer đối soát HĐ (`onOpenFinancials`). Khi có cờ VAT, hiển thị song song cả `FileCheck` và `Link2`.
7. **Tuân Thủ Tuyệt Đối `/ui-atomic-refactor`**:
   - 100% files liên quan kiểm soát chặt chẽ dưới ngưỡng **< 180 LoC** (`GarageCaseCodeCell`: 98 LoC, `financial-columns`: 172 LoC, `general-columns`: 175 LoC, `date-columns`: 62 LoC, `progress-columns`: 158 LoC, `classification-dropdown`: 176 LoC, `exclusion-dropdown`: 166 LoC). 100% i18n, No Blue Mandate và 56/56 test files phân hệ Garage đạt PASS.

### 9.7. Chuẩn Hóa Hiển Thị Tài Chính Mới: Pro Data 2 Hàng (Tổng Thu/Trả), Ngày Kết Thúc KGara, Cột Thuế GTGT & 6 Dải Màu Biên LN

1. **Hiển Thị Pro Data 2 Hàng (`GarageCaseProgressCell`)**:
   - Loại bỏ hoàn toàn thanh thước ngang progress bar cũ trên cả 2 cột **Tổng phải thu** (`collectionProgress`) và **Tổng phải trả** (`costProgress`).
   - **Hàng 1 (Hàng trên - Thực thu / Thực chi)**: Số tiền đã thanh toán (`paid`) kèm tỷ lệ `%` hoàn thành (`text-xs font-semibold tabular-nums font-mono`). Màu sắc phân cấp rõ nét: `emerald` (khi hoàn thành 100% hoặc đã thu), `amber` (cho chi phí vật tư/phụ tùng), `muted-foreground` (khi 0%).
   - **Hàng 2 (Hàng dưới - Mục tiêu tổng)**: Số tiền tổng phát sinh (`total`) định dạng font-mono phụ trợ (`text-[11px] font-mono tabular-nums text-muted-foreground leading-tight`).
   - Giữ trọn vẹn Tooltip chi tiết khi hover chuột (hiển thị Đã thu/trả, Còn phải thu/trả, và Tổng).
2. **Quy Tắc Ngày Kết Thúc 100% Dựa Vào KGara (`ngayHoanThanhCongViec`)**:
   - Cột **Ngày kết thúc** (`completionDate` / `ngayHoanThanhCongViec`) chỉ lấy dữ liệu hoàn thành công việc từ KGara (`item.ngayHoanThanhCongViec` / `item.rawData?.NgayHoanThanhCongViec`).
   - **Tuyệt đối KHÔNG fallback sang ngày tiếp nhận** (`ngayTiepNhan`) hay ngày phát sinh (`ngayPhatSinh`). Phiếu chưa hoàn tất trên xưởng sẽ hiển thị placeholder `—`.
3. **Đổi Tên Cột "HĐ VAT" Thành "Thuế GTGT"**:
   - Cột `hasInvoice` đổi nhãn header và hiển thị thành **"Thuế GTGT"** (i18n VI: `"Thuế GTGT"`, EN: `"VAT"`).
4. **Atom `GarageMarginBadge` Phân 6 Dải Màu Chuẩn Xuất Excel**:
   - Cột **Biên LN** (`margin`) tích hợp Atom `GarageMarginBadge` phân chia trực quan theo 6 dải màu chuẩn mực:
     - Dải 1 (`< 0%` - Âm): Rose nhạt (`bg-rose-100 text-rose-800 border-rose-200/60 dark:bg-rose-950/60 dark:text-rose-300`).
     - Dải 2 (`0% - < 20%` - Thấp): Amber nhạt (`bg-amber-100 text-amber-800 border-amber-200/60 dark:bg-amber-950/60 dark:text-amber-300`).
     - Dải 3 (`20% - < 40%` - Trung bình): Sky nhạt (`bg-sky-100 text-sky-800 border-sky-200/60 dark:bg-sky-950/60 dark:text-sky-300`).
     - Dải 4 (`40% - < 60%` - Khá): Emerald nhạt (`bg-emerald-100 text-emerald-800 border-emerald-200/60 dark:bg-emerald-950/60 dark:text-emerald-300`).
     - Dải 5 (`60% - < 80%` - Tốt): Teal nhạt (`bg-teal-100 text-teal-800 border-teal-200/60 dark:bg-teal-950/60 dark:text-teal-300`).
     - Dải 6 (`>= 80%` - Xuất sắc): Purple nhạt (`bg-purple-100 text-purple-800 border-purple-200/60 dark:bg-purple-950/60 dark:text-purple-300`).
     - Khi chưa có doanh thu hoặc `doanhThu <= 0`: Hiển thị `—`.
5. **Kiểm Soát Kiến Trúc `/ui-atomic-refactor` & `/api-service-refactor`**:
   - 100% UI files kiểm soát dưới **< 180 LoC** (`GarageMarginBadge`: 77 LoC, `GarageCaseProgressCell`: 82 LoC, `progress-columns`: 163 LoC, `financial-columns`: 141 LoC, `date-columns`: 73 LoC, `general-columns`: 176 LoC).
   - Co-located tests 100% pass, No Blue Mandate bảo toàn, 100% i18n.

### 9.8. Tinh Chỉnh UI Pro Data Nâng Cao, Thứ Tự Cột Trạng Thái & Bóc Tách 4 Cột Excel Sheet 1

1. **Vị Trí Cột Trạng Thái (`statusName`)**:
   - Trong cả 2 chế độ xem **Tổng quan** (`overview`) và **Đối soát** (`audit`), cột **Trạng thái** (`statusName`) được di chuyển sang nằm **ngay bên phải cột Khách hàng** (`customer`).
   - Thứ tự logic chuẩn: `# -> Ngày tiếp nhận -> Ngày kết thúc -> Số chứng từ -> Khách hàng -> Trạng thái -> ...`.
   - Đồng bộ trong cả `GarageCasesTable.general-columns.tsx`, `DEFAULT_GARAGE_CASE_COLUMN_VISIBILITY`, `AUDIT_GARAGE_CASE_COLUMN_VISIBILITY` và `GARAGE_CASE_COLUMN_GROUPS`.

2. **Tinh Chỉnh UI Pro Data (`GarageCaseProgressCell`)**:
   - **Micro-labels**:
     - Hàng 1: Hiển thị nhãn `Đã thu:` (cho receivable) hoặc `Đã trả:` (cho payable) bằng `text-[10px] text-muted-foreground` bên cạnh số tiền đã thanh toán.
     - Hàng 2: Hiển thị nhãn `Tổng:` bằng `text-[10px] text-muted-foreground/70` bên cạnh số tiền tổng phát sinh.
   - **Mini Badge Pill `{rate}%`**:
     - Thay thế định dạng text trong ngoặc đơn cũ bằng mini badge pill có viền:
       - 100% (Hoàn thành): `bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20`.
       - 0% (Chưa thu/trả): `bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 border-slate-200 dark:border-slate-700`.
       - Đang thực hiện: `bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20` (payable) hoặc `bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20` (receivable).
   - **Độ rộng cột**: Nâng từ `140px` lên `155px` cho cả 2 cột `collectionProgress` và `costProgress` để bảo đảm số tiền hàng trăm triệu và nhãn không bị tràn.

3. **Bóc Tách 4 Cột Thu/Chi Mới trong Sheet 1 Xuất Excel Bảng Kê Phiếu Kết Thúc (`COMPLETED_CASES_COLUMNS`)**:
   - Mở rộng Sheet 1 từ 23 lên 27 cột:
     - **Cột 10 (J)**: `Phải thu BH (VNĐ)` (`phaiThuBaoHiem`) - lấy từ `TienThanhToanBH` hoặc `TienBaoHiemDuyet`.
     - **Cột 11 (K)**: `Phải thu KH (VNĐ)` (`phaiThuKhachHang`) - lấy từ `TienThanhToanKH` hoặc `phaiThu - phaiThuBaoHiem`.
     - **Cột 12 (L)**: `Phải thu (VNĐ)` (`phaiThu`) - sử dụng công thức động Excel: `=SUM(J{row}:K{row})`.
     - **Cột 16 (P)**: `Chi phí nhân công (VNĐ)` (`chiPhiNhanCong`) - lấy từ `Math.max(0, phaiTra - gvPt)`.
     - **Cột 17 (Q)**: `Chi phí phụ tùng (VNĐ)` (`chiPhiPhuTung`) - lấy từ giá vốn phụ tùng `gvPt` của các dòng chi tiết `serviceLinesMap`.
     - **Cột 18 (R)**: `Phải trả (VNĐ)` (`phaiTra`) - sử dụng công thức động Excel: `=SUM(P{row}:Q{row})`.
   - Cập nhật toàn bộ các công thức phụ thuộc:
     - `Còn lại phải thu`: `=L{row}-M{row}`
     - `Còn lại phải trả`: `=R{row}-S{row}`
     - `Lợi nhuận gộp`: `=V{row}-W{row}`
     - `Biên LN (%)`: `=IF(V{row}>0, X{row}/V{row}, 0)`
     - Dòng `SUM` và `SUBTOTAL` cập nhật margin tham chiếu cột `V` (Doanh thu) và `X` (Lợi nhuận).

