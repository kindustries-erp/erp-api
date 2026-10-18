---
name: api-v2-refactor
description: Playbook tạo và chuyển module erp-api sang kiến trúc API v2 (Facade + sub-services + mapper + response DTO + spec co-located) bằng plop api-module-v2; gồm quy ước, bẫy đã biết và checklist kiểm tra.
---

# Kỹ Năng API v2 Refactor (`erp-api`)

Workflow đầy đủ: [`../../workflows/api-v2-refactor.md`](../../workflows/api-v2-refactor.md). Skill này là checklist và quy ước để thực thi workflow.

## 1. Quy ước v2

| Lớp | File | Quy tắc |
| :--- | :--- | :--- |
| Entity | `entities/*.entity.ts` | Cột snake_case qua `name:`; cờ `isDeleted` (không dùng `DeleteDateColumn`) |
| DTO vào | `dto/create-*.dto.ts`, `update-*` (PartialType), `query-*` (PaginationDto) | class-validator + Swagger |
| DTO ra | `dto/*-response.dto.ts` | Không trả entity ra ngoài module |
| Mapper | `helpers/*.mapper.ts` | Hàm thuần. Hai chiều: entity→response, DTO→entity (bỏ `undefined`) |
| Đọc | `services/*-query.service.ts` | Chỉ đọc, lọc `isDeleted = false` |
| Ghi | `services/*-command.service.ts` | create / update / softDelete |
| Facade | `<module>.service.ts` | Điều phối, `NotFoundException`, luôn trả response DTO |
| Controller | `controllers/*.controller.ts` | `@RequirePermissions({ resource: ErpResource.X, action: ErpAction.READ\|CREATE\|UPDATE\|DELETE })` |

Enum quyền: `src/rbac-core/enums/erp-action.enum.ts` (`ErpAction`), `src/rbac-core/enums/erp-resource.enum.ts` (`ErpResource`). Không dùng chuỗi literal cho quyền.

## 2. Kiểu trường (`fieldSpec`)

| Kiểu | Cột TypeORM | DTO vào | Ghi chú |
| :--- | :--- | :--- | :--- |
| `string` | varchar(255) | `string` | Tham gia ô tìm kiếm chung |
| `text` | text | `string` | Tham gia ô tìm kiếm chung |
| `number` | integer | `number` | |
| `decimal` | numeric(18,2) | `number` | Entity giữ `string` (TypeORM); response ép `number` |
| `boolean` | boolean, default false | `boolean` | |
| `date` | timestamptz | `string` (ISO) | DTO→entity đổi thành `Date` |
| `status` | varchar(50), default `ACTIVE` | `string` ∈ `ACTIVE/INACTIVE` | Sửa danh sách giá trị thủ công nếu nghiệp vụ khác |

## 3. Bẫy đã gặp (đã xử lý trong generator)

1. **Plop ghi đè dữ liệu bằng giá trị prompt rỗng.** Node-plop chỉ copy `data` của action khi key chưa có trong câu trả lời. Vì vậy prompt phải dùng hậu tố `Input` (`tableNameInput`, `moduleInput`, …) để không trùng key dữ liệu đã tính.
2. **`Object.assign` với `undefined` xóa dữ liệu cũ.** Mapper `to<Entity>EntityFields` đã lọc `undefined`. Không bỏ bước này.
3. **Import thừa làm lint lỗi** (`--max-warnings=0`). Generator tính import theo đúng decorator được dùng.
4. **Decimal nullable** trả `undefined`, không `Number(null)` (sẽ ra `0`).
5. **Handlebars escape** mặc định làm hỏng dấu `'` và `"`. Template dùng `{{{ }}}` cho đoạn code.
6. **`@Entity('')` hoặc `@Controller('')`** xuất hiện nếu bỏ qua mặc định. Đã có fallback trong `apiV2Data.mjs`.

## 4. Checklist sau khi sinh

- [ ] `bunx prettier --write "src/<module>-core/**/*.ts"`
- [ ] Route không trùng controller khác (`grep -rn "@Controller('<route>')" src`)
- [ ] `ErpResource` có entry mới (luôn được thêm bởi generator). Xác nhận seed quyền ở `rbac-core` không cần bước tay khác.
- [ ] `wire` đã nối đúng `app.module.ts` và `data-source.ts` (nếu chọn `true`). Nếu chọn `false`, phải nối tay.
- [ ] Nghiệp vụ thêm vào command/query service, kèm spec
- [ ] `bun run type:check`, `bunx jest src/<module>-core --forceExit`, `bunx eslint` đều pass
- [ ] Module skill `.agents/skills/modules/<module>/SKILL.md` đã cập nhật (Knowledge-Sync)

## 5. Test generator

```bash
bun test plop-helpers
```

Các file trong `plop-helpers/` là hàm thuần: `apiV2Fields`, `apiV2Data`, `apiV2Files`, `apiV2Wiring`. Dùng `bun:test`. Jest của repo không chạy được ở đây vì `rootDir` là `src`.

## 6. Giới hạn

- Không sinh nghiệp vụ, không sinh phân quyền theo dữ liệu, không sinh audit log.
- Không kiểm tra trùng route hay trùng `ErpResource` lúc sinh. Lỗi trùng sẽ lộ khi `tsc` (enum) hoặc lúc chạy (route).
- `column-options`, tìm kiếm theo cột (`column_search`) và sắp xếp động không có trong template v2. Module cần thì thêm vào query service.
