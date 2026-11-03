---
name: erp-api-structure
description: "Playbook cấu trúc code của erp-api (NestJS) - ngưỡng kích thước file, cách tách Controller/Service thành Facade + sub-services, kiến trúc module v2 (Facade + sub-services + mapper + response DTO + spec) và quy trình sinh bằng plop. Dùng khi refactor, tách file lớn, hoặc tạo/chuyển module sang v2 trong erp-api. Nạp erp-api-truth trước."
---

<!-- GENERATED FILE - DO NOT EDIT. Nguồn canonical (skill): .agents/skills/erp-api-structure/SKILL.md -->

Đọc toàn bộ và làm theo skill canonical tại `.agents/skills/erp-api-structure/SKILL.md` trước khi thực hiện công việc.
Đọc thêm toàn bộ resource (references/, scripts/, assets/) nằm cạnh nguồn canonical khi workflow/skill yêu cầu.
Mọi đường dẫn liên quan được tính từ thư mục chứa nguồn canonical; không sửa wrapper generated này.
