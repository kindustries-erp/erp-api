     1|# ERP Backend (NestJS + Directus)
     2|
     3|Dự án Backend cho hệ thống ERP, được xây dựng bằng NestJS và kết nối với Directus làm hệ quản trị nội dung (CMS) và cơ sở dữ liệu.
     4|
     5|## 🚀 Tính năng chính
     6|
     7|- **Authentication**: Luồng Proxy đăng ký/đăng nhập trực tiếp qua Directus SDK.
     8|- **Directus Integration**: Kết nối SDK toàn cục, hỗ trợ gọi API Directus từ NestJS.
     9|- **Dockerized**: Sẵn sàng chạy trong container Docker.
    10|- **Validation**: Kiểm tra dữ liệu đầu vào chặt chẽ với Class Validator.
    11|
    12|## 📖 Tài liệu API
    13|
    14|- [Full API Documentation](file:///C:/Users/home/.gemini/antigravity/brain/eb9c5b42-fdb6-482b-b2a1-5f5410361ea3/full_api_documentation.md)
    15|- [Directus Pagination Standard](file:///C:/Users/home/.gemini/antigravity/brain/eb9c5b42-fdb6-482b-b2a1-5f5410361ea3/directus_pagination_standard.md) (Quy định về phân trang giữa Backend & Frontend)
    16|- [RBAC API](docs/api-rbac.md)
    17|
    18|---
    19|
    20|## 🛠 Hướng dẫn khởi chạy khi Pull từ Repo về
    21|
    22|### 1. Yêu cầu hệ thống
    23|
    24|- **Bun / Node.js** (Phiên bản 24 trở lên khuyến nghị)
    25|- **Docker & Docker Compose** (Nếu muốn chạy qua Docker)
    26|- **Instance Directus** đã sẵn sàng.
    27|
    28|### 2. Thiết lập môi trường (.env)
    29|
    30|Dự án không lưu file `.env` lên Git vì lý do bảo mật. Bạn cần tạo file này dựa trên mẫu:
    31|
    32|1. Copy file ví dụ:
    33|   ```bash
    34|   cp .env.example .env
    35|   ```
    36|2. Mở file `.env` và điền các thông tin sau:
    37|   - `PORT`: Cổng chạy ứng dụng (Mặc định: 10000).
    38|   - `DIRECTUS_URL`: URL của Directus (ví dụ: `https://db-production.liouni.com`).
    39|   - `DIRECTUS_ADMIN_TOKEN`: Static Admin Token lấy từ Directus Admin UI.
    40|
    41|### 3. Chạy ứng dụng
    42|
    43|#### Cách 1: Chạy trực tiếp trên máy (Development)
    44|
    45|```bash
    46|# 1. Cài đặt thư viện
    47|bun install
    48|
    49|# 2. Chạy chế độ watch (tự động reload khi đổi code)
    50|bun run start:dev
    51|```
    52|
    53|#### Cách 2: Chạy bằng Docker (Khuyên dùng)
    54|
    55|```bash
    56|# Build và khởi chạy container dưới nền
    57|docker-compose up -d --build
    58|```
    59|
    60|Ứng dụng sẽ chạy tại: `http://localhost:10000/api/v1`
    61|
    62|---
    63|
    64|## 🔌 API Endpoints (Cơ bản)
    65|
    66|| Method             | Endpoint                         | Mô tả                                                       |
    67|| :----------------- | :------------------------------- | :---------------------------------------------------------- |
    68|| `POST`             | `/api/v1/auth/register`          | Đăng ký tài khoản mới (Proxy qua Directus)                  |
    69|| `POST`             | `/api/v1/auth/login`             | Đăng nhập lấy access_token của Directus                     |
    70|| `POST`             | `/api/v1/auth/refresh`           | Làm mới access_token bằng refresh_token                     |
    71|| `POST`             | `/api/v1/auth/logout`            | Đăng xuất (Vô hiệu hóa refresh_token)                       |
    72|| `POST`             | `/api/v1/auth/change-password`   | Đổi mật khẩu cho user đang đăng nhập (Yêu cầu Bearer Token) |
    73|| `GET`              | `/api/v1/me`                     | Lấy profile cá nhân (Yêu cầu Bearer Token)                  |
    74|| `GET`              | `/api/v1/employees/:id`          | Lấy thông tin chi tiết nhân viên (Yêu cầu Bearer Token)     |
    75|| `PATCH`            | `/api/v1/employees/:id`          | Cập nhật thông tin nhân viên (Yêu cầu Bearer Token)         |
    76|| `---`              | `---`                            | `---`                                                       |
    77|| `GET/POST`         | `/api/v1/departments`            | Quản lý danh mục phòng ban (`gw_departments`)               |
    78|| `GET/PATCH/DELETE` | `/api/v1/departments/:id`        | Thao tác chi tiết phòng ban                                 |
    79|| `GET/POST`         | `/api/v1/positions`              | Quản lý danh mục chức danh (`gw_positions`)                 |
    80|| `GET/PATCH/DELETE` | `/api/v1/positions/:id`          | Thao tác chi tiết chức danh                                 |
    81|| `GET/POST`         | `/api/v1/company-bank-accounts`  | Quản lý tài khoản ngân hàng công ty                         |
    82|| `GET/POST`         | `/api/v1/business-partner-roles` | Quản lý vai trò đối tác kinh doanh                          |
    83|| `GET/POST`         | `/api/v1/chart-of-accounts`      | Quản lý hệ thống tài khoản kế toán                          |
    84|| `GET`              | `/api/v1/activity-logs`          | Lấy danh sách log hoạt động (từ `directus_activity`)        |
    85|
    86|---
    87|
    88|## 📁 Cấu trúc thư mục
    89|
    90|- `src/directus`: Cấu hình kết nối Directus SDK.
    91|- `src/auth`: Module xử lý xác thực và phân quyền.
    92|- `src/auth/guards`: Chứa `DirectusAuthGuard` để bảo vệ các API.
    93|- `Dockerfile` & `docker-compose.yml`: Cấu hình đóng gói ứng dụng.
    94|
    95|---
    96|
    97|## 📝 Giấy phép
    98|
    99|Dự án thuộc bản quyền của **Liouni Production**.
   100|