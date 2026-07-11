# API Module Template (ERP API)

## Khi dùng
Dùng khi thêm module/domain mới trong `src/<domain>/...` hoặc tách domain cũ đang phình to.

## Folder shape tối thiểu
```text
src/<domain>/
  <domain>.module.ts
  <domain>.controller.ts
  <domain>.service.ts
  dto/
    create-<domain>.dto.ts
    update-<domain>.dto.ts
    query-<domain>.dto.ts
  entities/
    <domain>.entity.ts
  __tests__/
    <domain>.service.spec.ts
```

## Boundary chuẩn
- Controller: route, guards, params/query/body parsing, swagger decorators nếu có
- DTO: request boundary
- Service: business orchestration
- Entity: persistence shape
- Mapper/helper: tách riêng khi transform bắt đầu lặp lại hoặc service phình to

## Checklist tạo module
1. Tạo task file trước
2. Gate 0 DB precheck: `DB_READY` hoặc `DB_GAP_FOUND`
3. Tạo module/controller/service/DTO/entity theo domain
4. Đăng ký module trong `src/app.module.ts`
5. Nếu có route mới, ghi Web handoff rõ path + response shape
6. Chạy `bun run lint:check`
7. Chạy `bun run build`
8. Chạy test scope gần nhất (`bunx jest --forceExit` hoặc spec liên quan)
9. Cập nhật task evidence + commit/push

## Mẫu tối thiểu
### Controller
```ts
@Controller('api/v1/<resource>')
export class <Domain>Controller {
  constructor(private readonly service: <Domain>Service) {}
}
```

### Service
```ts
@Injectable()
export class <Domain>Service {
  async list(query: Query<Domain>Dto) {
    return { items: [], total: 0 };
  }
}
```

## Anti-patterns
- Nhét toàn bộ transform/query/business vào 1 service duy nhất
- Dùng entity làm response contract mặc định nếu contract có thể đổi độc lập
- Tạo helper mới khi `src/common/**` hoặc domain hiện có đã đủ tái sử dụng
- Quên import module vào `src/app.module.ts`
