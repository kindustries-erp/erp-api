# ERP API — Security Baseline (reference)

Tài liệu tham chiếu của `erp-api-truth`. Đọc khi task thêm hoặc sửa endpoint, auth, DTO, upload, xử lý lỗi hoặc truy vấn SQL. Mọi lệnh chạy từ gốc repo `erp/erp-api`, dùng `bash` (trong zsh phải để nguyên dấu nháy đơn quanh pattern). Dùng `must` cho điều đã enforce, `prefer` cho hướng đi mục tiêu.

## 1. Checklist cho code mới (`must` trừ khi ghi `prefer`)

1. **Guard**: controller có `@UseGuards(JwtAuthGuard)` (kèm `CoreRbacGuard` khi cần phân quyền theo quyền). Repo không có global guard (không có `APP_GUARD`/`useGlobalGuards`), nên controller thiếu guard là endpoint mở. Endpoint công khai chủ ý phải ghi rõ lý do ngay trên controller.
2. **DTO**: `@Body()` và `@Query()` luôn khai báo bằng class DTO có `class-validator`. Không dùng `any` hay kiểu inline (`{ id: string }`). `ValidationPipe` toàn cục (`whitelist`, `forbidNonWhitelisted`, `transform`) chỉ hoạt động khi tham số có class.
3. **Secret**: không đặt giá trị mặc định cho secret, key hay mật khẩu. Dùng `ConfigService.getOrThrow()` để thiếu env thì khởi động thất bại. `.env.example` chỉ chứa placeholder.
4. **Upload**: mọi `FileInterceptor`/`FilesInterceptor` có `limits: { fileSize }` và kiểm loại file (`fileFilter` hoặc `ParseFilePipe` với `MaxFileSizeValidator`/`FileTypeValidator`). Mẫu: `invoice-original-pdf.controller.ts` dùng hằng số `MAX_MANUAL_PDF_BYTES`.
5. **Lỗi trả về client**: không trả nguyên `exception.message` của TypeORM hay `Error` không kiểm soát ở production. Ghi chi tiết bằng `Logger` phía server, trả thông điệp chung. Stack chỉ trả ở môi trường không phải production (đã làm trong `common/filters/all-exceptions.filter.ts`).
6. **SQL**: truy vấn tham số hóa. Nội suy `${}` chỉ cho tên cột hoặc tên tham số lấy từ whitelist nội bộ (ví dụ `mapColumnToSqlField()`), không bao giờ cho giá trị do người dùng gửi lên.
7. **Token**: không thêm đường nhận JWT qua query string cho endpoint mới. Nếu bắt buộc (tải file, SSE), ghi lý do vào task.
8. **Log**: dùng `Logger` của NestJS, không `console.*`. Không log password, token, secret, header `Authorization`.
9. **Xóa dữ liệu**: xóa mềm bằng `isDeleted` (mandate trong `.agents/AGENTS.md`). Thao tác nhiều bảng dùng transaction.
10. **`prefer`**: test phủ trường hợp thiếu token (401) và thiếu quyền (403) cho endpoint mới, cạnh `.spec.ts` của controller.

## 2. Kiểm nhanh (kết quả phải rỗng với code mới)

```bash
# 1. Controller thiếu guard
grep -rLE '@UseGuards|@Public\(' src --include='*.controller.ts'

# 2. Body/Query kiểu any hoặc inline
grep -rnE '@(Body|Query)\(\)\s*\w+:\s*(any|\{)' src --include='*.ts' --exclude='*.spec.ts'

# 3. Upload không có tùy chọn limits
grep -rnE "File(s)?Interceptor\('[A-Za-z]+'(,\s*[0-9]+)?\)" src --include='*.ts' --exclude='*.spec.ts'

# 4. Secret có giá trị mặc định (multi-line)
grep -rPzo "(SECRET|_KEY|PASSWORD)'\s*,\s*'[^']+'" src --include='*.ts' | tr '\0' '\n'

# 5. Nhận token qua query string
grep -rn 'fromUrlQueryParameter' src --include='*.ts'

# 6. Nội suy trong .query( ngoài migrations
grep -rnE '\.query\(\s*`[^`]*\$\{' src --include='*.ts' --exclude-dir=migrations --exclude='*.spec.ts'

# 7. console.* trong code chạy thật
grep -rnE 'console\.(log|error|warn)' src --include='*.ts' --exclude='*.spec.ts'
```

Lệnh 6 chỉ thấy nội suy trên một dòng; truy vấn nhiều dòng phải đọc tay. Các `where(...)` có nội suy thường chỉ nội suy tên tham số (ví dụ `:kw${i}`); cần xem phần được nội suy có đến từ whitelist hay không.

## 3. Nợ đã biết (ghi nhận 2026-11-03, kiểm lại bằng lệnh ở mục 2 trước khi dựa vào)

Đây là chỗ code hiện tại chưa đạt checklist. Không dùng làm mẫu cho code mới, và không tự sửa trừ khi task được duyệt (thứ tự DB → API → UI → QC).

- `accounting-core.controller.ts` không có guard và gồm endpoint ghi (PATCH journal-entries, POST/PATCH/DELETE chart-of-accounts). Cần xác nhận lại bằng request thật không kèm token trước khi kết luận.
- `JWT_SECRET` có giá trị mặc định ở `auth/auth.module.ts` và `auth/jwt.strategy.ts`; `jwt.strategy.ts` còn nhận `access_token` qua query string.
- Khoảng 37 chỗ `@Body()`/`@Query()` dùng `any` hoặc kiểu inline (ví dụ `operating-expenses-core`, `erp-mfg-core`). Số này là ghi nhận 2026-11-03, chưa kiểm lại; `branches-management` đã có DTO validate body qua `ParseBranchBodyPipe` (xem module skill `branches-core`).
- 3 chỗ upload không có `limits`: `bom-core`, `files`, `bank-transactions-core`.
- `AllExceptionsFilter` trả `exception.message` của TypeORM và `Error` cho client ở mọi môi trường.
- Chưa thấy giới hạn tần suất, `helmet` hay khóa đăng nhập sai ở tầng ứng dụng (không có trong `package.json`). Hạ tầng phía trước (NPM/nginx) có thể đã xử lý; xác nhận rồi ghi vào Trilium trước khi thêm dependency.
- CORS `origin: true` kèm `credentials: true`. Xác thực hiện dùng Bearer token, không dùng cookie, nên rủi ro thấp; nếu chuyển sang cookie thì phải siết `origin`.

## 4. Khi báo xong

Ghi rõ đã chạy mục kiểm nào (lệnh, kết quả), mục nào không áp dụng và vì sao. Nếu endpoint mới đổi response hoặc route, ghi việc Web cần làm theo (xem `erp-api-truth` mục 7).
