---
name: cases-garage
description: Module vụ việc Kgara v2 (api/v2/cases-garage) - danh sách vụ việc, hạng mục dịch vụ, báo cáo lợi nhuận gộp, chi tiết. Chỉ đọc, dùng lại bảng kgara_*. Đọc trước khi sửa 3 endpoint cases của Kgara.
---

# cases-garage (api/v2/cases-garage)

Vị trí: `src/v2/modules/cases-garage`. Quyền `GARAGE:READ`, chi nhánh bắt buộc. Thay 3 endpoint V1: `cases`, `cases/services`, `cases/gross-profit-report` (V1 còn song song).

## 1. Route (route cố định trước `:id`)
`GET /`, `column-options`, `services`, `gross-profit-report`, `by-code/:code`, `:id`. Query DTO: `QueryCasesGarageDto` (`page`, `pageSize` tối đa 200, `search`, `sort` "a,-b", `column_filters` JSON, `date_from/date_to`, `summary_keys`, `serviceType`).

## 2. Quy tắc dữ liệu
- Vụ việc đang hoạt động: `kgara_deleted_at IS NULL`.
- Gross profit join bằng `vu_viec_code = so_chung_tu` (KHÔNG theo `hd_phieu_dich_vu_id`, khớp 0/531 trên staging). Lọc ngày theo `report_from/report_to` như V1. Phân trang và tổng bằng SQL.
- Hạng mục: `kgara_case_services` join vụ việc theo `hd_phieu_dich_vu_id`; tổng, tổng trang, lũy kế bằng `applyListSummaries` (V1 cộng JS).
- List vụ việc dùng lại helper lọc/sắp xếp V1 (`applyCaseListFilters`...); tổng 8 cột khớp V1.
- Số tiền là number; không trả `raw_data`.
- Dòng list có thêm `soKhung`, `doiTuongThanhToanCode`, `doiTuongThanhToanName` (null khi thiếu). Nguồn và quy tắc ghi xem `garage-cases` mục "Số khung & đối tượng thanh toán".

## 3. Khác V1
Chi nhánh bắt buộc; filter cột áp trên dòng gom biển số; không có tổng "còn phải trả" ở list; không nhánh normalized-plate ở column-options.

## 4. Chưa làm
Ghi settlement/linked-invoice vẫn ở V1 (plan orchestration).
