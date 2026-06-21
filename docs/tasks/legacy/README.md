# Legacy Tasks Archive

Thư mục này chứa các task artifacts từ **trước ngày 2026-06-07** — giai đoạn Directus-era / legacy operational lane, trước khi ERP core chuyển sang branch `erp-master` trên GitHub.

## Quy tắc đọc

- **Không dùng** các file này làm implementation guidance mặc định cho lane `erp-master`.
- Dùng **chỉ khi** task hiện tại yêu cầu:
  - audit lịch sử lineage
  - tái sử dụng logic từ legacy module (cashflow, AR/AP, sinvoice...)
  - điều tra regression liên quan code cũ
- Nếu có mâu thuẫn giữa file trong thư mục này và docs hiện tại dưới `/opt/docs/ai/`, **docs hiện tại thắng**.

## Boundary

- Mọi task mới tạo cho lane `erp-master` đặt ở `docs/tasks/` (thư mục cha), không đặt ở đây.
- Không di chuyển file từ `legacy/` lên `docs/tasks/` trừ khi anh mở lại scope legacy rõ ràng.
