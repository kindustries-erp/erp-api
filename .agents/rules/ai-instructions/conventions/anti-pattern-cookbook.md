# Anti-Pattern Cookbook

## Backend
### 1. God service
Một service chứa query, validation, transform, permission branching, export/import trong cùng file.

**Fix:** tách helper/mapper/use-case nội bộ theo domain.

### 2. DTO leakage ngược
Entity/persistence shape vô tình trở thành public contract.

**Fix:** tách response shape hoặc mapper khi contract bắt đầu có lifecycle riêng.

### 3. Hidden registration miss
Tạo module/controller xong nhưng quên import vào `src/app.module.ts`.

**Fix:** module checklist bắt buộc có registration line item.

### 4. Duplicate helper
Tạo util/service mới mà không check `src/common/**` hoặc domain gần nhất.

**Fix:** reuse-first, ghi lý do nếu vẫn tạo mới.
