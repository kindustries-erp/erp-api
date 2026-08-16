---
name: scan-module-knowledge
description: Quét toàn bộ kiến thức một module backend (DB, Entity, DTO, Controller, Service, Permissions, Cross-module) trong erp-api để tạo mới hoặc cập nhật file skill tại .agents/skills/modules/<module-name>/SKILL.md.
---

# 🔍 Module Knowledge Scanner & Updater (`erp-api`)

## Mục đích

Cung cấp quy trình quét tự động và chuẩn hoá để **tạo mới hoặc cập nhật** tài liệu tri thức cho bất kỳ module nào trong `erp-api`. Giúp Agent các phiên sau làm việc trên module đó có thể đọc ngay skill mà không tốn token quét toàn bộ mã nguồn.

---

## Khi nào sử dụng?

- Khi người dùng yêu cầu: *"Quét module X và lưu vào .agents"* hoặc *"Cập nhật skill cho module X"*.
- Khi một module backend vừa được phát triển xong hoặc refactor có thay đổi về Database schema, DTOs, API endpoints hoặc logic nghiệp vụ.

---

## Quy trình Thực hiện (5 Bước Chuẩn)

### Bước 1: Quét Database Schema (Gate 0)
1. Xác định các bảng chính và bảng phụ thuộc của module (vd: `erp_boms`, `erp_bom_lines`).
2. Kiểm tra schema thực tế trong PostgreSQL thông qua `DATABASE_URL` hoặc xem các file entity (`src/<module>/entities/*.entity.ts`) và migration gần nhất (`src/migrations/`).
3. Liệt kê bảng cấu trúc:
   - Tên cột, kiểu dữ liệu, nullability, default value, khóa chính, foreign keys, unique index.

### Bước 2: Quét DTOs & Validation Rules
1. Đọc toàn bộ thư mục `src/<module>/dto/`.
2. Ghi nhận các DTO tạo (`create`), cập nhật (`update`), danh sách/lọc (`list`), và nested DTOs.
3. Ghi nhận các validator decorators (`@IsUUID`, `@IsNumberString`, `@ValidateNested`, `@IsOptional`, etc.).

### Bước 3: Quét Controller, API Routes & RBAC
1. Đọc `src/<module>/<module>.controller.ts`.
2. Trích xuất:
   - Base path controller (vd: `@Controller('bom')` -> `/api/v1/bom`).
   - Danh sách endpoints: Method (`GET`, `POST`, `PATCH`, `DELETE`), đường dẫn, params, query, body.
   - Resource & Action trong `@RequirePermissions({ resource: '...', action: '...' })`.
   - Các interceptors đặc biệt (vd: `FileInterceptor` upload, download stream/buffer).

### Bước 4: Quét Service Logic & Cross-module Hooks
1. Đọc `src/<module>/<module>.service.ts`.
2. Xác định các luồng nghiệp vụ quan trọng:
   - Quản lý transaction (`dataSource.transaction`).
   - Xử lý dữ liệu đặc biệt (tính toán, đệ quy, import/export Excel/CSV, cache).
   - Tích hợp với các module khác (vd: `production-core`, `inventory-core`, `accounting-core`).

### Bước 5: Sinh hoặc Cập nhật File Skill Chuẩn

Tạo hoặc cập nhật file tại đường dẫn:
```text
erp-api/.agents/skills/modules/<module-name>/SKILL.md
```

#### Template Mẫu Cho File Skill:
```markdown
---
name: <module-name>
description: Module tri thức <Tên Module> trong erp-api. Chứa toàn bộ database schema, entities, DTOs, API endpoints, business logic và tích hợp liên module.
---

# 📦 Module Tri Thức: <Tên Module> - Backend (`erp-api`)

## 1. Tổng quan Nghiệp vụ
[Tóm tắt vai trò và mục đích của module]

## 2. Database Schema & Quan hệ Dữ liệu
[Bảng chi tiết các trường, kiểu dữ liệu, ràng buộc, index]

## 3. Cấu trúc Source Code Backend
[Sơ đồ cây file trong src/<module>/]

## 4. Danh sách API Endpoints & RBAC Contract
[Bảng phương thức, endpoint, quyền hạn, mô tả]

## 5. Logic Nghiệp vụ Trọng tâm
[Các thuật toán, transaction, xử lý dữ liệu cốt lõi]

## 6. Tích hợp Liên Module
[Mối quan hệ gọi chéo với các module khác]

## 7. Quy tắc Kiểm thử & Báo cáo Chất lượng
[Lệnh test, typecheck, precheck cần chạy khi sửa module]
```

---

## Danh mục Kiểm tra Hoàn tất (Checklist)

- [ ] Đã quét đủ cả Entity, DTO, Controller, Service của module.
- [ ] File skill được lưu đúng tại `erp-api/.agents/skills/modules/<module-name>/SKILL.md`.
- [ ] YAML frontmatter có `name` (trùng tên module) và `description` rõ ràng.
- [ ] Thư mục `modules` đã được đăng ký trong `.agents/skills.json`.
- [ ] Đã cập nhật tham chiếu trong `erp-api/.agents/skills/liouni-erp-api-current-truth/SKILL.md`.
