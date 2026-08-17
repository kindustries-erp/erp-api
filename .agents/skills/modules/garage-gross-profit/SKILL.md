---
name: garage-gross-profit
description: Module tri thức Báo cáo & Phân tích Lợi nhuận gộp Vụ việc Garage (Gross Profit Analysis & Linked Invoices) trong erp-api (kgara-api-core). Chứa toàn bộ database schema, entities, API endpoints, logic tổng hợp doanh thu/giá vốn/lãi gộp, đối soát hóa đơn VAT và đồng bộ dữ liệu.
---

# 📦 Module Tri Thức: Báo Cáo & Phân Tích Lợi Nhuận Gộp Vụ Việc Garage (Gross Profit) - Backend (`erp-api`)

## 1. Tổng quan Nghiệp vụ

Phân hệ Báo cáo Lợi Nhuận Gộp Garage (`kgara-api-core`) cung cấp giải pháp tài chính - kế toán giúp chủ doanh nghiệp và kế toán trưởng theo dõi, phân tích và đối soát chính xác doanh thu, chi phí giá vốn và biên lợi nhuận gộp phát sinh từ từng vụ việc dịch vụ sửa chữa xe tại hệ thống xưởng Garage.

Các nghiệp vụ trọng tâm:
- **Tổng hợp Chỉ số Tài chính Vụ việc (`kgara_gross_profit`)**: Bóc tách và lưu trữ các chỉ số cốt lõi của từng vụ việc:
  $$\text{Lợi Nhuận Gộp (LoiNhuan)} = \text{Doanh Thu (DoanhThu)} - \text{Chi Phí / Giá Vốn (ChiPhi)}$$
- **Báo cáo Phân Tích Lợi Nhuận Gộp Đa Chiều (`/cases/gross-profit-report`)**: Tổng hợp dữ liệu theo chi nhánh xưởng (`branchExternalId`) và khoảng thời gian (`from`, `to`), tự động tính toán tổng số tiền toàn bộ danh sách (`TongCong: { DoanhThu, ChiPhi, LaiGop }`) và nhóm danh sách chi tiết kèm dữ liệu vụ việc gốc (`caseData`).
- **Tự động Đồng bộ Lợi Nhuận Kèm Theo Vụ Việc (`syncCasesForBranch`)**: Khi đồng bộ danh sách vụ việc, hệ thống tự động xác định danh sách các tháng có phát sinh hoặc thay đổi để kích hoạt đồng bộ tương ứng bảng lợi nhuận gộp từ KGara.
- **Đối Soát Chứng Từ Hóa Đơn Thuế (`kgara_case_linked_invoice`)**: Cho phép kế toán gắn kết trực tiếp các hóa đơn điện tử đầu vào (hóa đơn mua vật tư, phụ tùng thay thế - `linkType = 'IN'`) và hóa đơn điện tử đầu ra (hóa đơn thanh toán dịch vụ xuất cho khách - `linkType = 'OUT'`) vào từng bản ghi lợi nhuận gộp để kiểm chứng tính minh bạch và dòng tiền thực tế.
- **Truy Xuất Sổ Nhật Ký Chi Tiết KGara (Journal Proxy)**: Tích hợp proxy gọi trực tiếp sang API báo cáo sổ nhật ký chi tiết (`/reports/gross-profit-detail/journal`) của KGara để kiểm tra từng bút toán chi phí gốc.

---

## 2. Database Schema & Quan hệ Dữ liệu

### 2.1. Bảng `kgara_gross_profit` (Sổ Tổng Hợp Lợi Nhuận Gộp Vụ Việc)

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

### 2.2. Bảng `kgara_case_linked_invoice` (Liên Kết Hóa Đơn Thuế Với Lợi Nhuận Gộp)

| Cột | Kiểu dữ liệu | Nullable | Mặc định | Mô tả / Ràng buộc |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `uuid` | NO | `gen_random_uuid()` | Khóa chính (PK) |
| `gross_profit_id` | `uuid` | YES | `NULL` | FK tham chiếu `kgara_gross_profit.id` (ON DELETE CASCADE) |
| `caseDbId` | `uuid` | YES | `NULL` | FK tham chiếu `kgara_cases.id` (ON DELETE CASCADE) |
| `invoiceId` | `uuid` | NO | — | FK tham chiếu `erp_invoices.id` |
| `linkType` | `varchar(10)` | NO | `'IN'` | Phân loại: `'IN'` (Hóa đơn chi phí đầu vào) hoặc `'OUT'` (Hóa đơn doanh thu đầu ra) |
| `note` | `varchar` | YES | `NULL` | Ghi chú kế toán khi liên kết |
| `created_at` | `timestamptz` | NO | `now()` | Thời điểm tạo liên kết |
| `updated_at` | `timestamptz` | NO | `now()` | Thời điểm cập nhật |

---

### 2.3. Sơ đồ Quan hệ Dữ liệu (ERD)

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

## 3. Cấu trúc Source Code Backend

```text
src/kgara-api-core/
├── entities/
│   ├── kgara_gross_profit.entity.ts        # Entity bảng kgara_gross_profit
│   ├── kgara_case_linked_invoice.entity.ts # Entity bảng kgara_case_linked_invoice (liên kết với gross_profit_id)
│   └── kgara_case.entity.ts                # Entity bảng kgara_cases (quan hệ 1-1 với gross profit qua hd_phieu_dich_vu_id)
├── kgara-api-core.controller.ts            # Controller chứa các endpoints /cases/gross-profit-report, /gross-profit/...
├── kgara-sync.service.ts                   # Service chứa logic syncGrossProfitForBranch và upsert lợi nhuận gộp
└── kgara-client.service.ts                 # Service gọi API getGrossProfitDetail và getGrossProfitJournal từ KGara
```

---

## 4. Danh sách API Endpoints & RBAC Contract

Controller Base Route: `/api/v1/greenway`  
Header nhận diện Chi nhánh: `x-kgara-branch-id` hoặc `x-greenway-branch-id`

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

---

## 5. Logic Nghiệp vụ Trọng tâm

### 5.1. Thuật toán Tổng Hợp Báo Cáo Lợi Nhuận Gộp (`getGrossProfitReport`)
1. Truy vấn toàn bộ bản ghi trong bảng `kgara_gross_profit` theo `branchExternalId` và dải ngày `reportFrom >= from`, `reportTo <= to`.
2. Thực hiện `leftJoinAndMapOne` với bảng `kgara_cases` dựa trên điều kiện `case.soChungTu = gp.vuViecCode` để bổ sung toàn bộ metadata của xe (biển số xe, ngày phát sinh, khách hàng).
3. Duyệt danh sách, chuyển đổi kiểu dữ liệu (`Number(gp.doanhThu)`, `Number(gp.chiPhi)`, `Number(gp.loiNhuan)`).
4. Tích lũy tổng doanh thu (`totalRevenue`), tổng chi phí (`totalCost`), tổng lãi gộp (`totalProfit`).
5. Trả về cấu trúc chuẩn tương thích giao diện UI:
   ```json
   {
     "results": {
       "TongCong": {
         "DoanhThu": 150000000,
         "ChiPhi": 95000000,
         "LaiGop": 55000000
       },
       "Groups": [
         {
           "Items": [ ... ]
         }
       ]
     }
   }
   ```

### 5.2. Cơ chế Đồng bộ Tự động Đa Tháng (`syncCasesForBranch` Waterfall Sync)
- Khi thực hiện đồng bộ vụ việc (`syncCasesForBranch`), hệ thống tự động ghi nhận danh sách các ngày phát sinh vụ việc (`updatedCaseDates`).
- Nếu người dùng không chỉ định khoảng ngày (`from`, `to`), hệ thống tự động sinh dải ngày:
  - Tháng hiện tại: từ ngày 1 đến ngày cuối tháng.
  - Các tháng trước/sau có vụ việc thay đổi (`monthsToSync`).
- Hệ thống duyệt qua từng khoảng tháng và gọi `getGrossProfitDetail`, sau đó thực hiện lệnh `upsert` trên bảng `kgara_gross_profit` theo khóa xung đột `['hdPhieuDichVuId']`.

### 5.3. Đối Soát & Kiểm Tra Hóa Đơn Thuế Gắn Kèm (`kgara_case_linked_invoice`)
- Phân loại 2 chiều:
  - `linkType = 'IN'`: Hóa đơn mua phụ tùng, dầu nhớt, vật tư tiêu hao đầu vào cấu thành nên chi phí vụ việc.
  - `linkType = 'OUT'`: Hóa đơn điện tử VAT xuất cho khách hàng tương ứng với doanh thu dịch vụ.
- Ràng buộc toàn vẹn: Khi bản ghi `kgara_gross_profit` hoặc `kgara_cases` bị xóa, các dòng liên kết hóa đơn tương ứng sẽ tự động bị xóa theo (`onDelete: 'CASCADE'`), đảm bảo không để lại bản ghi mồ côi.

---

## 6. Tích hợp Liên Module

- **`garage-cases`**:
  - Tích hợp chặt chẽ qua mã định danh `hd_phieu_dich_vu_id` và số chứng từ `so_chung_tu`.
  - Cửa sổ xem chi tiết lợi nhuận gộp (`GarageGrossProfitDetailDrawer`) có thể mở trực tiếp từ màn hình Vụ việc dịch vụ (`GarageCases`).
- **`erp-invoices-core`**:
  - Hỗ trợ kế toán kiểm tra chéo giữa chi phí sổ sách KGara và hóa đơn thuế GTGT thực tế đã phát hành hoặc tiếp nhận từ Tổng cục Thuế.

---

## 7. Quy tắc Kiểm thử & Báo cáo Chất lượng (QC Mandate)

Khi chỉnh sửa `garage-gross-profit`:
1. Chạy Type-check: `bun run check:ci`
2. Chạy Unit test: `bunx jest src/kgara-api-core/ --forceExit`
3. Kiểm tra tính toàn vẹn khóa ngoại trong migration `1780000000000-AddKgaraGrossProfit.ts` và `1786414442074-LedgerCascade.ts`.
