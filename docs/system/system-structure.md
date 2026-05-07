# Cấu trúc Hệ thống ERP Backend

Tài liệu này mô tả cấu trúc thư mục, các module chính và kiến trúc tổng thể của hệ thống ERP Backend.

## 1. Tổng quan Kiến trúc
Hệ thống được xây dựng trên nền tảng **NestJS**, sử dụng **Directus** làm Headless CMS và cơ sở dữ liệu chính. Backend đóng vai trò là một lớp Proxy/Gateway để xử lý logic nghiệp vụ, xác thực, phân quyền và quản lý quy trình làm việc (workflow) trước khi tương tác với Directus.

### Công nghệ sử dụng:
- **Framework**: NestJS (v11)
- **Database/CMS**: Directus (thông qua `@directus/sdk`)
- **Authentication**: JWT & Passport
- **Documentation**: Swagger API
- **Validation**: class-validator & class-transformer

---

## 2. Cấu trúc Thư mục Chính
```text
erp-backend/
├── src/                    # Mã nguồn chính
│   ├── activity-logs/      # Nhật ký hoạt động hệ thống
│   ├── auth/               # Xác thực và phân quyền (JWT, Passport)
│   ├── common/             # Các decorator, interceptor, filter dùng chung
│   ├── directus/           # Cấu hình kết nối Directus SDK
│   ├── rbac/               # Quản lý phân quyền dựa trên vai trò (Role-Based Access Control)
│   ├── files/              # Quản lý file và đính kèm thông qua Directus
│   │
│   ├── employees/          # Quản lý nhân viên
│   ├── departments/        # Quản lý phòng ban
│   ├── positions/          # Quản lý chức vụ
│   │
│   ├── chart-of-accounts/  # Hệ thống tài khoản kế toán
│   ├── opening-balances/   # Số dư đầu kỳ
│   ├── cash-funds/         # Quản lý quỹ tiền mặt
│   ├── company-bank-accounts/ # Tài khoản ngân hàng công ty
│   │
│   ├── business-partners/  # Quản lý đối tác (Khách hàng/NCC)
│   ├── business-partner-roles/ # Vai trò đối tác
│   ├── business-partner-contacts/ # Liên hệ của đối tác
│   ├── business-partner-bank-accounts/ # TK ngân hàng của đối tác
│   │
│   ├── payment-vouchers/   # Quản lý Phiếu thu / Phiếu chi
│   ├── payment-voucher-attachments/ # Đính kèm của phiếu thu chi
│   ├── payment-voucher-approval-logs/ # Nhật ký duyệt phiếu
│   ├── voucher-numbering-configs/ # Cấu hình đánh số chứng từ tự động
│   │
│   ├── app.module.ts       # Module gốc, đăng ký tất cả các module con
│   └── main.ts             # Điểm khởi đầu ứng dụng
│
├── docs/                   # Tài liệu hướng dẫn và API
├── test/                   # Các bài kiểm tra (Unit & E2E)
└── .env                    # Biến môi trường (Directus URL, Token, v.v.)
```

---

## 3. Danh sách các Module

### Nhóm Hệ thống (Core & System)
- **AuthModule**: Xử lý đăng nhập, cấp phát JWT và bảo mật các endpoint.
- **DirectusModule**: Cung cấp Provider kết nối với Directus SDK trên toàn hệ thống.
- **RbacModule**: Quản lý ma trận quyền, cho phép lấy thông tin quyền của User từ Directus.
- **ActivityLogsModule**: Ghi lại các thao tác thay đổi dữ liệu của người dùng.
- **FilesModule**: Proxy để upload/download file lên Directus.
- **VoucherNumberingConfigsModule**: Cấu hình quy tắc đặt số cho các loại chứng từ (Prefix, Padding, Current Number).

### Nhóm Nhân sự (HR)
- **EmployeesModule**: Quản lý hồ sơ nhân viên, liên kết với tài khoản người dùng trong Directus.
- **DepartmentsModule**: Quản lý cơ cấu tổ chức phòng ban.
- **PositionsModule**: Quản lý các chức danh trong công ty.

### Nhóm Tài chính (Finance & Accounting)
- **PaymentVouchersModule**: Module quan trọng nhất, xử lý quy trình lập, duyệt và hạch toán phiếu thu/chi (Tiền mặt/Ngân hàng).
- **OpeningBalancesModule**: Thiết lập số dư ban đầu cho các tài khoản, quỹ và ngân hàng.
- **CashFundsModule**: Quản lý danh sách các quỹ tiền mặt của đơn vị.
- **CompanyBankAccountsModule**: Quản lý danh sách tài khoản ngân hàng của công ty.
- **ChartOfAccountsModule**: Danh mục hệ thống tài khoản kế toán.

### Nhóm Đối tác (Business Partners)
- **BusinessPartnersModule**: Quản lý thông tin chung về Khách hàng và Nhà cung cấp.
- **BusinessPartnerContacts**: Thông tin liên hệ chi tiết.
- **BusinessPartnerBankAccounts**: Thông tin tài khoản ngân hàng của đối tác để thực hiện chuyển khoản.

---

## 4. Quy trình xử lý dữ liệu (Workflow)
Hầu hết các module đều tuân theo mô hình:
1. **Controller**: Tiếp nhận Request, validation dữ liệu qua DTO.
2. **Service**: Thực hiện logic nghiệp vụ, sau đó gọi Directus SDK để lưu trữ dữ liệu.
3. **Directus**: Lưu trữ dữ liệu thực tế và xử lý các quan hệ (relationships).

Riêng **PaymentVouchers** có quy trình trạng thái (Status Workflow):
`DRAFT` -> `PENDING_APPROVAL` -> `APPROVED` -> `POSTED` (Vào sổ cái).

---

## 5. Tài liệu tham khảo
- [API Auth & Profile](./api-auth-profile.md)
- [API RBAC](./api-rbac.md)
