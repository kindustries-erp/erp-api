# Task: Fix empty goods issue on start production

- Mục tiêu: Ngăn chặn hệ thống tạo các phiếu xuất kho (Goods Issue) rỗng (tổng số lượng bằng 0) khi bấm "Bắt đầu sản xuất" (startProduction).
- Lý do: Nếu Lệnh sản xuất có BOM rỗng hoặc định mức NVL = 0, hoặc đã xuất trước đó, thì `toIssue <= 0` cho toàn bộ vật tư. Code trước đây sinh sẵn vỏ phiếu xuất kho trước khi tạo chi tiết, dẫn đến phiếu xuất rỗng trên UI.
- Thực hiện:
  - Sửa đổi hàm `startProduction` trong `src/production-core/production-core.service.ts`.
  - Kiểm tra xem có NVL vật lý nào thực sự cần xuất không (`aggregatedToIssue.size > 0`).
  - Nếu có, mới tiến hành tạo header `erp_goods_issues`.
  - Nếu không, chỉ đổi trạng thái thành `IN_PROGRESS` và trả về `goodsIssueId: null` với thông báo "Không có vật tư cần xuất thêm".
- Validation:
  - Chạy `bun run check:ci` thành công.
  - Chạy `bun run build` thành công.
- Thời gian: 2026-07-03
