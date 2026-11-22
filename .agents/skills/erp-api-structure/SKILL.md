---
name: erp-api-structure
description: Playbook cấu trúc code của erp-api (NestJS) - ngưỡng kích thước file, cách tách Controller/Service thành Facade + sub-services, kiến trúc module v2 (Facade + sub-services + mapper + response DTO + spec) và quy trình sinh bằng plop. Dùng khi refactor, tách file lớn, hoặc tạo/chuyển module sang v2 trong erp-api. Nạp erp-api-truth trước.
---

# ERP API — Structure & Refactor

Workflow đi kèm (cùng tên): `.agents/workflows/erp-api-structure.md`.

Skill gộp hai playbook: refactor Controller/Service cũ (v1) và kiến trúc module v2. Nạp `erp-api-truth` trước để có ngữ cảnh repo, lane và rule DB.

Mọi thay đổi cấu trúc chỉ làm khi user yêu cầu rõ hoặc task đã được duyệt. Scanner trong skill chỉ báo cáo, không tự sửa code.

## 1. Chọn hướng xử lý

| Tình huống | Làm gì | Tài liệu chi tiết |
| :--- | :--- | :--- |
| File vượt ngưỡng, module cũ (v1) | Tách theo Pattern A-E, giữ nguyên contract | `references/service-controller-refactor.md` |
| Tạo module mới, hoặc chuyển module cũ sang v2 | Sinh bằng `api-module-v2` / `api-voucher-v2`, rồi làm theo checklist | `references/v2-module.md` |
| Module đã v2 nhưng còn file lớn | Không refactor lại kiểu v1. Làm theo quy ước v2 | `references/v2-module.md` |

Chuyển đổi: module đã migrate hoặc đang migrate sang v2 thì không refactor v1 nữa, chuyển sang v2.

## 2. Ngưỡng kích thước

| Loại file | Cảnh báo | Nghiêm trọng | Hành động |
| :--- | :---: | :---: | :--- |
| Controller (`*.controller.ts`) | > 300 dòng | ≥ 1.000 dòng | Pattern A: Sub-Controllers |
| Service (`*.service.ts`) | > 500 dòng | ≥ 1.000 dòng | Pattern B: Sub-Services + Facade |
| Khác (logic, helper, engine) | > 800 dòng | ≥ 1.000 dòng | Pattern C: Pure Engine / Query Builder |

Quét toàn repo:

```bash
bun .agents/skills/erp-api-structure/scripts/scan-oversized-files.ts                  # toàn repo (src + scripts)
bun .agents/skills/erp-api-structure/scripts/scan-oversized-files.ts --path=src/ai-hub-core
bun .agents/skills/erp-api-structure/scripts/scan-oversized-files.ts --json           # cho CI/agent
bun .agents/skills/erp-api-structure/scripts/scan-oversized-files.ts --strict         # exit 1 nếu vi phạm Clean DI
```

## 3. Bất biến phải giữ khi refactor

1. **REST contract**: không đổi route path, HTTP status, header, query param hoặc response DTO.
2. **Chữ ký service**: file service gốc đóng vai trò Facade và delegate sang sub-services, để controller/module khác không gãy.
3. **Transaction**: thao tác ghi nhiều bảng phải nằm trọn trong một service, hoặc truyền transaction context rõ ràng. Không mở connection lồng nhau.
4. **Clean DI constructor**: không dùng overload, không inject thừa. Mỗi class có một constructor duy nhất. Xem chi tiết trong reference.
5. **DTO và entity**: không để entity rò ra ngoài module. Response luôn đi qua response DTO.

## 4. Pattern refactor v1 (tóm tắt)

- **A. Sub-Controllers**: tách controller theo resource REST. Controller gốc chỉ còn gom route.
- **B. Sub-Services + Facade**: mỗi nhóm nghiệp vụ thành một sub-service. Service gốc giữ chữ ký cũ và delegate.
- **C. Pure Engine / Query Builder**: logic thuần, query builder và mapper tách ra helper không phụ thuộc DI.
- **D. Tách DTO và Entity**: mapper hai chiều, không trả entity ra ngoài.
- **E. Domain Handlers**: cho gateway và module đa domain.

Các bước thực hiện từng giai đoạn và checklist: xem `references/service-controller-refactor.md`.

## 5. Kiến trúc module v2

Cấu trúc chuẩn (vd: `src/v2/modules/<module>/`):

| Lớp | File | Quy tắc |
| :--- | :--- | :--- |
| Entity | `entities/*.entity.ts` | Cột snake_case qua `name:`. Cờ `isDeleted`, không dùng `DeleteDateColumn` |
| DTO vào | `dto/create-*.dto.ts`, `update-*` (PartialType), `query-*` (PaginationDto) | class-validator + Swagger |
| DTO ra | `dto/*-response.dto.ts` | Không trả entity ra ngoài |
| Mapper | `helpers/*.mapper.ts` | Hàm thuần, hai chiều, bỏ `undefined` khi map DTO → entity |
| Đọc | `services/*-query.service.ts` | Chỉ đọc, lọc `isDeleted = false` |
| Ghi | `services/*-command.service.ts` | create / update / softDelete / hardDelete (có điều kiện, xem `erp-api-structure` Phần B mục "Chính sách xóa") |
| Facade | `<module>.service.ts` | Điều phối, throw `NotFoundException`, luôn trả response DTO |
| Controller | `controllers/*.controller.ts` | `@RequirePermissions({ resource: ErpResource.X, action: ErpAction.* })` |

- Quyền dùng enum `ErpAction` và `ErpResource` (trong `src/v2/core/rbac-core/enums/`, xuất qua `@/v2/core/rbac-core`), không dùng chuỗi literal.
- Import trong module dùng alias `@/`. Generator tự sinh đúng vị trí `src/v2/modules/...`.
- Core dùng chung nằm ở `src/v2/core/<core-name>/` (ví dụ `goods-receipts`, base voucher engine).
- Module v1 nằm riêng (`src/<module>-core/`), không trộn vào v2.

Sinh module:

- `api-module-v2`: module CRUD chuẩn theo fieldSpec.
- `api-voucher-v2`: module chứng từ, dùng core voucher engine.
- Module đã có entity/service cũ: không chạy generator lên thư mục đó. Làm theo mục 3b của `references/v2-module.md`.

Chi tiết về kiểu trường (`fieldSpec`), hợp đồng HTTP, bẫy đã gặp, checklist sau khi sinh, test generator và trạng thái migrate: xem `references/v2-module.md`.

## 6. Checklist tối thiểu trước khi báo xong

- [ ] `bun run type:check` pass.
- [ ] `bunx jest --forceExit` (hoặc scope liên quan) pass. Ghi rõ scope đã chạy.
- [ ] Scanner `--strict` không báo vi phạm trong phạm vi đã đổi.
- [ ] Module mới đã được import trong `src/app.module.ts`.
- [ ] Route, DTO response và chữ ký service công khai không đổi, trừ khi task yêu cầu đổi.
- [ ] Đã query DB xác nhận schema với mọi thay đổi DTO/persistence.

## 7. Tài liệu đi kèm

- `references/service-controller-refactor.md`: Pattern A-E, ngưỡng, bất biến, checklist v1.
- `references/v2-module.md`: quy ước v2, fieldSpec, hợp đồng HTTP, generator, trạng thái migrate.
- `scripts/scan-oversized-files.ts`: scanner kích thước file và vi phạm Clean DI.
- Workflow đầy đủ: `.agents/workflows/erp-api-structure.md` và `.agents/workflows/erp-api-structure.md`.
