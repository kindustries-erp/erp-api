# Business Partners V2 API

## Kết quả

- Mở rộng API danh sách với `column_operators` và `date_ranges`, giữ tương thích bộ lọc V1.
- Áp dụng whitelist cột/toán tử cho text, ngày, blank và chọn toàn bộ kết quả tìm kiếm.
- Đồng bộ cross-filter cho `column-options` với cả payload V1 và V2.
- Không thay đổi schema và không ghi dữ liệu thử.

## DB Gate

- Đọc `DATABASE_URL` trực tiếp từ `.env`.
- `SELECT current_database()` trả về `erp_greenway_production`.
- Chỉ đọc schema/index của `erp_business_partners`.

## Verification

```bash
bunx jest src/business-partners-core/business-partners-core.service.spec.ts --runInBand
bunx eslint src/business-partners-core/business-partners-core.service.ts src/business-partners-core/business-partners-core.service.spec.ts src/business-partners-core/business-partners-query-filter.util.ts src/common/dto/pagination.dto.ts --max-warnings=0
bun run type:check
```

- Scoped Jest: 17 tests PASS.
- ESLint scoped và TypeScript: PASS.
- Build và style toàn repo: PASS.
- Full Jest: 175 suites, 1.291 tests PASS, 10 skipped.
- `verify:final` không được gọi trực tiếp vì guard yêu cầu working tree đã commit; chuỗi lệnh bên trong script đã chạy đầy đủ trên mã hiện tại.

## Kiểm tra thủ công

1. Gọi danh sách CUSTOMER/VENDOR bằng request V1 và xác nhận kết quả không đổi.
2. Gọi request V2 với text operator, date range, `__BLANK__` và `__ALL_MATCHING__`.
3. Gọi `column-options` với filter ở cột khác và xác nhận options/count được lọc chéo.
